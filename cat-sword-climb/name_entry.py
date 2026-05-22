ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
NAME_LENGTH = 3


class NameEntry:
    def __init__(self, initial="AAA"):
        cleaned = "".join(char for char in initial.upper() if char in ALPHABET)
        cleaned = (cleaned + "A" * NAME_LENGTH)[:NAME_LENGTH]
        self.letters = [ALPHABET.index(char) for char in cleaned]
        self.slot = 0
        self.done = False

    @property
    def initials(self):
        return "".join(ALPHABET[index] for index in self.letters)

    def cycle_letter(self, direction):
        if self.done:
            return
        self.letters[self.slot] = (self.letters[self.slot] + direction) % len(ALPHABET)

    def advance(self):
        if self.done:
            return
        if self.slot < NAME_LENGTH - 1:
            self.slot += 1
        else:
            self.done = True

    def backspace(self):
        if self.done:
            return
        if self.slot > 0:
            self.slot -= 1
