#!/usr/bin/env python3
"""Fix truck schema to use enum values properly"""

# Read the current file
with open('/app/app/schemas/truck.py', 'r') as f:
    content = f.read()

# Fix TruckUpdate class - add Config with use_enum_values
if 'class TruckUpdate(BaseModel):' in content and 'class TruckUpdate' not in content.split('class Config:')[0].split('class TruckUpdate')[-1]:
    content = content.replace(
        '    current_driver_id: Optional[int] = None\n\n\nclass TruckResponse',
        '''    current_driver_id: Optional[int] = None

    class Config:
        use_enum_values = True


class TruckResponse'''
    )

# Fix TruckResponse class - add use_enum_values to existing Config
if 'class TruckResponse' in content:
    # Find and replace the Config in TruckResponse
    lines = content.split('\n')
    new_lines = []
    in_response = False
    in_config = False
    config_fixed = False

    for i, line in enumerate(lines):
        if 'class TruckResponse' in line:
            in_response = True
            config_fixed = False

        if in_response and 'class Config:' in line:
            in_config = True
            new_lines.append(line)
            continue

        if in_config and 'from_attributes = True' in line and not config_fixed:
            new_lines.append(line)
            new_lines.append('        use_enum_values = True')
            config_fixed = True
            in_config = False
            continue

        if in_response and line.strip() and not line.startswith(' ') and 'class' in line:
            in_response = False

        new_lines.append(line)

    content = '\n'.join(new_lines)

# Write back
with open('/app/app/schemas/truck.py', 'w') as f:
    f.write(content)

print("✓ Fixed truck schema")
print("\nNow restarting uvicorn...")

import os
os.system("pkill -f uvicorn")
