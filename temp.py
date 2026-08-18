with open("frontend/src/pages/TeamSpinWheel.tsx", "r", encoding="utf-8") as f:
    c = f.read()

import re

# Remove Navbar and Footer imports if present
c = re.sub(r'import Navbar from [^\n]+\n', '', c)
c = re.sub(r'import Footer from [^\n]+\n', '', c)
# Remove Navigate import if it's there
# wait, Navigate might still be needed if we want to redirect unauthenticated users, but TeamPaymentSuccess already handles that!
# Let's see if we should just remove the top-level loading and auth checks, since TeamPaymentSuccess has them.
# Actually, it's safer to keep the component totally self-contained, but just remove the full-page layout CSS.
