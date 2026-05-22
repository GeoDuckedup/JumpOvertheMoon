ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
NAME_LENGTH = 3
BLOCKED_INITIALS = frozenset({
    "ASS", "FUK", "FUC", "FCK", "SHT", "SHI", "DIK", "DIQ",
    "DIC", "COK", "COC", "CUM", "FAG", "FAT", "GAY", "GOD",
    "JEW", "KKK", "NIG", "NGA", "NGR", "PIS", "POO", "SEX",
    "TIT", "TTS", "WTF", "STF", "SUK", "SUC", "VAG", "WOP",
    "KYS", "RAP", "FKU", "CNT", "CUN", "HOR", "HO3",
    "ANU", "ANL", "BUT", "BUM", "DAM", "DMN", "HEL",
    "JIZ", "KIK", "PEN", "PHK", "SCK", "SLT", "SMD",
})
CONFIRM_SUBMIT = "submit"
CONFIRM_REDO = "redo"


class NameEntry:
    def __init__(self, initial="AAA"):
        cleaned = "".join(char for char in initial.upper() if char in ALPHABET)
        cleaned = (cleaned + "A" * NAME_LENGTH)[:NAME_LENGTH]
        self.letters = [ALPHABET.index(char) for char in cleaned]
        self.slot = 0
        self.confirming = False
        self.confirm_choice = CONFIRM_SUBMIT
        self.done = False
        self.invalid_flash_timer = 0.0

    @property
    def initials(self):
        return "".join(ALPHABET[index] for index in self.letters)

    @property
    def blocked(self):
        return self.initials in BLOCKED_INITIALS

    def update(self, dt):
        self.invalid_flash_timer = max(0.0, self.invalid_flash_timer - dt)

    def flash_invalid(self):
        self.invalid_flash_timer = 0.55

    def cycle_letter(self, direction):
        if self.done:
            return
        if self.confirming:
            self.confirm_choice = CONFIRM_REDO if self.confirm_choice == CONFIRM_SUBMIT else CONFIRM_SUBMIT
            return
        self.letters[self.slot] = (self.letters[self.slot] + direction) % len(ALPHABET)
        self.invalid_flash_timer = 0.0

    def advance(self):
        if self.done:
            return
        if self.confirming:
            if self.confirm_choice == CONFIRM_REDO:
                self.redo()
                return
            if self.blocked:
                self.flash_invalid()
                return
            self.done = True
            return
        if self.slot < NAME_LENGTH - 1:
            self.slot += 1
        else:
            self.confirming = True
            self.confirm_choice = CONFIRM_SUBMIT

    def backspace(self):
        if self.done:
            return
        if self.confirming:
            self.redo(slot=NAME_LENGTH - 1)
            return
        if self.slot > 0:
            self.slot -= 1

    def redo(self, slot=0):
        if self.done:
            return
        self.confirming = False
        self.confirm_choice = CONFIRM_SUBMIT
        self.slot = max(0, min(NAME_LENGTH - 1, slot))
        self.invalid_flash_timer = 0.0
