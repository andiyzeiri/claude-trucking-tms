#!/bin/bash

echo "🔍 Verifying React Error Fixes..."
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check 1: Verify duplicate auth file is removed
echo -n "1. Checking duplicate auth hook removed... "
if [ ! -f "frontend/src/hooks/useAuth.tsx" ]; then
    echo -e "${GREEN}✓ PASS${NC}"
else
    echo -e "${RED}✗ FAIL${NC} - useAuth.tsx still exists!"
fi

# Check 2: Verify correct auth hook exists
echo -n "2. Checking correct auth hook exists... "
if [ -f "frontend/src/hooks/use-auth.ts" ]; then
    echo -e "${GREEN}✓ PASS${NC}"
else
    echo -e "${RED}✗ FAIL${NC} - use-auth.ts not found!"
fi

# Check 3: Verify ConditionalRender export exists
echo -n "3. Checking ConditionalRender export... "
if grep -q "export const ConditionalRender" frontend/src/components/auth/ProtectedRoute.tsx; then
    echo -e "${GREEN}✓ PASS${NC}"
else
    echo -e "${RED}✗ FAIL${NC} - ConditionalRender not exported!"
fi

# Check 4: Verify layout.tsx doesn't use AuthProvider
echo -n "4. Checking layout.tsx fixed... "
if ! grep -q "AuthProvider" frontend/src/app/layout.tsx; then
    echo -e "${GREEN}✓ PASS${NC}"
else
    echo -e "${RED}✗ FAIL${NC} - AuthProvider still in layout!"
fi

# Check 5: Verify imports are correct
echo -n "5. Checking import paths... "
WRONG_IMPORTS=$(grep -r "from '@/hooks/useAuth'" frontend/src --include="*.tsx" 2>/dev/null | wc -l)
if [ "$WRONG_IMPORTS" -eq 0 ]; then
    echo -e "${GREEN}✓ PASS${NC}"
else
    echo -e "${YELLOW}⚠ WARNING${NC} - Found $WRONG_IMPORTS file(s) with wrong import path"
    grep -r "from '@/hooks/useAuth'" frontend/src --include="*.tsx" 2>/dev/null
fi

# Check 6: Verify sidebar imports
echo -n "6. Checking sidebar imports... "
if grep -q "import { useAuth } from '@/hooks/use-auth'" frontend/src/components/layout/sidebar.tsx && \
   grep -q "import { ConditionalRender } from '@/components/auth/ProtectedRoute'" frontend/src/components/layout/sidebar.tsx; then
    echo -e "${GREEN}✓ PASS${NC}"
else
    echo -e "${RED}✗ FAIL${NC} - Sidebar imports incorrect!"
fi

echo ""
echo "📊 Verification Summary:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Count checks
TOTAL_CHECKS=6
PASSED_CHECKS=0

[ ! -f "frontend/src/hooks/useAuth.tsx" ] && ((PASSED_CHECKS++))
[ -f "frontend/src/hooks/use-auth.ts" ] && ((PASSED_CHECKS++))
grep -q "export const ConditionalRender" frontend/src/components/auth/ProtectedRoute.tsx && ((PASSED_CHECKS++))
! grep -q "AuthProvider" frontend/src/app/layout.tsx && ((PASSED_CHECKS++))
[ "$WRONG_IMPORTS" -eq 0 ] && ((PASSED_CHECKS++))
grep -q "import { useAuth } from '@/hooks/use-auth'" frontend/src/components/layout/sidebar.tsx && ((PASSED_CHECKS++))

echo "Passed: $PASSED_CHECKS / $TOTAL_CHECKS"

if [ $PASSED_CHECKS -eq $TOTAL_CHECKS ]; then
    echo -e "${GREEN}✅ All checks passed! Fixes verified.${NC}"
    echo ""
    echo "Next steps:"
    echo "  1. docker-compose down"
    echo "  2. docker-compose build web"
    echo "  3. docker-compose up -d"
    echo "  4. docker-compose logs -f web"
    exit 0
else
    echo -e "${RED}❌ Some checks failed. Review errors above.${NC}"
    exit 1
fi
