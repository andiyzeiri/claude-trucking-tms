"""
Read WEX / EFS daily transaction files from their SFTP server (GoAnywhere,
sftpus1.mft.wextransfer.com:22). WEX drops one file per day, named like
EFS_<carrierId>_<format>_<CCYYMMDD>.dat (TRANSFILE-<date>.csv on some
accounts). Files are only ever read here - never moved or deleted - and we
remember which ones were imported.

paramiko is blocking, so calls run in a worker thread. Network failures are
retried; a per-login circuit breaker backs off after repeated failures so a
WEX outage doesn't get hammered by the scheduler.
"""

import asyncio
import hashlib
import logging
import re
import stat
import time
from dataclasses import dataclass
from datetime import date, datetime
from typing import Dict, Iterable, List, Optional, Tuple

from starlette.concurrency import run_in_threadpool

logger = logging.getLogger(__name__)

DEFAULT_HOST = "sftpus1.mft.wextransfer.com"
DEFAULT_PORT = 22
TIMEOUT = 30
MAX_FILE_BYTES = 25 * 1024 * 1024
RETRIES = 3
BREAKER_FAILURES = 5
BREAKER_SECONDS = 600

# EFS_803535_110_20250311.dat / TRANSFILE-20210513.csv(.out)
FILE_DATE = re.compile(r"(20\d{6})")
FILE_NAME = re.compile(r"^(EFS_\d+_\d+_\d{8}|TRANSFILE-\d{8}(-\d+)?)\.(dat|csv|txt|out)(\.out)?$", re.I)
SKIP_DIRS = {"in", "inbound", "upload"}


class SftpError(Exception):
    """An SFTP step failed. `auth` is True when the login itself was rejected."""

    def __init__(self, message: str, auth: bool = False):
        super().__init__(message)
        self.auth = auth


@dataclass
class RemoteFile:
    path: str
    name: str
    size: int
    file_date: Optional[date]

    @property
    def key(self) -> str:
        return f"{self.path}:{self.size}"


_breaker: Dict[str, Tuple[int, float]] = {}


def file_date(name: str) -> Optional[date]:
    m = FILE_DATE.search(name)
    if not m:
        return None
    try:
        return datetime.strptime(m.group(1), "%Y%m%d").date()
    except ValueError:
        return None


def _connect(host: str, port: int, username: str, password: str):
    import paramiko

    transport = None
    try:
        sock_t = paramiko.Transport((host, port))
        transport = sock_t
        sock_t.banner_timeout = TIMEOUT
        sock_t.connect(username=username, password=password)
        return sock_t, paramiko.SFTPClient.from_transport(sock_t)
    except paramiko.AuthenticationException:
        if transport:
            transport.close()
        raise SftpError("WEX SFTP rejected the username or password", auth=True)
    except (paramiko.SSHException, OSError, EOFError) as e:
        if transport:
            transport.close()
        if "banner" in str(e).lower():
            # Connected, then dropped before SSH even started: the server only
            # accepts approved IP addresses.
            raise SftpError(f"{host} closed the connection before login - WEX probably needs to whitelist our IP address")
        raise SftpError(f"Couldn't connect to {host} ({e.__class__.__name__})")


def _walk(sftp, folder: str) -> Iterable[RemoteFile]:
    """Transaction files in `folder` and its immediate sub-folders (e.g. /out, /archive)."""
    try:
        entries = sftp.listdir_attr(folder)
    except IOError as e:
        raise SftpError(f"Can't open folder {folder!r} on the SFTP server ({e})")
    subdirs = []
    for e in entries:
        path = f"{folder.rstrip('/')}/{e.filename}"
        if stat.S_ISDIR(e.st_mode or 0):
            if e.filename.lower() not in SKIP_DIRS and not e.filename.startswith("."):
                subdirs.append(path)
        elif FILE_NAME.match(e.filename):
            yield RemoteFile(path, e.filename, e.st_size or 0, file_date(e.filename))
    if folder in ("", "/", "."):
        for sub in subdirs:
            try:
                for e in sftp.listdir_attr(sub):
                    if not stat.S_ISDIR(e.st_mode or 0) and FILE_NAME.match(e.filename):
                        yield RemoteFile(f"{sub}/{e.filename}", e.filename, e.st_size or 0, file_date(e.filename))
            except IOError:
                continue


def _fetch_sync(host, port, username, password, folder, since: date, done: set) -> Tuple[List[Tuple[RemoteFile, bytes]], int]:
    transport, sftp = _connect(host, port, username, password)
    try:
        files = list(_walk(sftp, folder or "/"))
        todo = [f for f in files if f.key not in done and (f.file_date is None or f.file_date >= since)]
        todo.sort(key=lambda f: (f.file_date or date.min, f.name))
        out = []
        for f in todo:
            if f.size > MAX_FILE_BYTES:
                logger.warning("wex_sftp: skipping %s (%s bytes)", f.path, f.size)
                continue
            with sftp.open(f.path, "rb") as fh:
                out.append((f, fh.read()))
        return out, len(files)
    finally:
        sftp.close()
        transport.close()


def _key(username: str, host: str) -> str:
    return hashlib.sha256(f"{username}@{host}".encode()).hexdigest()[:16]


async def fetch_new_files(host: str, port: int, username: str, password: str, folder: str,
                          since: date, done: set) -> Tuple[List[Tuple[RemoteFile, bytes]], int]:
    """(new files with their bytes, oldest first; how many transaction files the server has)."""
    k = _key(username, host)
    failures, open_until = _breaker.get(k, (0, 0.0))
    if open_until > time.monotonic():
        raise SftpError("WEX SFTP isn't responding - will try again in a few minutes")
    last: Optional[SftpError] = None
    for attempt in range(RETRIES):
        if attempt:
            await asyncio.sleep(2 ** attempt)
        try:
            result = await run_in_threadpool(_fetch_sync, host, port, username, password, folder, since, done)
            _breaker.pop(k, None)
            return result
        except SftpError as e:
            if e.auth or "Can't open folder" in str(e):
                raise
            last = e
    failures += 1
    _breaker[k] = (failures, time.monotonic() + BREAKER_SECONDS if failures >= BREAKER_FAILURES else 0.0)
    raise last or SftpError("WEX SFTP failed")


async def check_login(host: str, port: int, username: str, password: str, folder: str) -> int:
    """Raises SftpError if we can't log in and list the folder; returns how many transaction files are there."""
    def run():
        transport, sftp = _connect(host, port, username, password)
        try:
            return len(list(_walk(sftp, folder or "/")))
        finally:
            sftp.close()
            transport.close()

    return await run_in_threadpool(run)
