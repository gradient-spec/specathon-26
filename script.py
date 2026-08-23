with open("frontend/src/pages/TeamSpinWheel.tsx", "r", encoding="utf-8") as f:
    c = f.read()

bad_condition = """        // NEW LOGIC: Only enforce NOT_ISSUED if config.current_mode === 'LIVE'
        if (config.current_mode === "LIVE" && teamData.spin_ticket === "NOT_ISSUED") {"""

# Let's see what is actually in the file.
