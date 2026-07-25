export const INITIALS_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
export const INITIALS_LENGTH = 3;

export const BLOCKED_INITIALS = new Set([
  "ASS", "FUK", "FUC", "FCK", "SHT", "SHI", "DIK", "DIQ",
  "DIC", "COK", "COC", "CUM", "FAG", "FAT", "GAY", "GOD",
  "JEW", "KKK", "NIG", "NGA", "NGR", "PIS", "POO", "SEX",
  "TIT", "TTS", "WTF", "STF", "SUK", "SUC", "VAG", "WOP",
  "KYS", "RAP", "FKU", "CNT", "CUN", "HOR", "HO3", "ANU",
  "ANL", "BUT", "BUM", "DAM", "DMN", "HEL", "JIZ", "KIK",
  "PEN", "PHK", "SCK", "SLT", "SMD",
]);

export const sanitizeInitials = (value = "AAA") => {
  const cleaned = String(value)
    .toUpperCase()
    .split("")
    .filter((character) => INITIALS_ALPHABET.includes(character))
    .join("");
  return (cleaned || "AAA").slice(0, INITIALS_LENGTH).padEnd(INITIALS_LENGTH, "A");
};

export class NameEntry {
  constructor(initial = "AAA") {
    this.letters = [...sanitizeInitials(initial)].map((character) =>
      INITIALS_ALPHABET.indexOf(character),
    );
    this.slot = 0;
    this.confirming = false;
    this.confirmChoice = "submit";
    this.done = false;
    this.invalidFlashTimer = 0;
  }

  get initials() {
    return this.letters
      .map((index) => INITIALS_ALPHABET[index])
      .join("");
  }

  get blocked() {
    return BLOCKED_INITIALS.has(this.initials);
  }

  update(dt) {
    this.invalidFlashTimer = Math.max(0, this.invalidFlashTimer - dt);
  }

  cycle(direction) {
    if (this.done) {
      return false;
    }
    if (this.confirming) {
      this.confirmChoice =
        this.confirmChoice === "submit" ? "redo" : "submit";
      return true;
    }
    const count = INITIALS_ALPHABET.length;
    this.letters[this.slot] =
      (this.letters[this.slot] + Math.sign(direction || 1) + count) % count;
    this.invalidFlashTimer = 0;
    return true;
  }

  typeCharacter(character) {
    if (this.done || this.confirming) {
      return false;
    }
    const index = INITIALS_ALPHABET.indexOf(
      String(character || "").toUpperCase(),
    );
    if (index < 0) {
      return false;
    }
    this.letters[this.slot] = index;
    this.invalidFlashTimer = 0;
    if (this.slot < INITIALS_LENGTH - 1) {
      this.slot += 1;
    } else {
      this.confirming = true;
      this.confirmChoice = "submit";
    }
    return true;
  }

  advance() {
    if (this.done) {
      return "done";
    }
    if (this.confirming) {
      if (this.confirmChoice === "redo") {
        this.redo();
        return "redo";
      }
      if (this.blocked) {
        this.invalidFlashTimer = 0.55;
        return "blocked";
      }
      this.done = true;
      return "submit";
    }
    if (this.slot < INITIALS_LENGTH - 1) {
      this.slot += 1;
      return "next";
    }
    this.confirming = true;
    this.confirmChoice = "submit";
    return "confirm";
  }

  backspace() {
    if (this.done) {
      return false;
    }
    if (this.confirming) {
      this.redo(INITIALS_LENGTH - 1);
      return true;
    }
    if (this.slot > 0) {
      this.slot -= 1;
    }
    return true;
  }

  redo(slot = 0) {
    if (this.done) {
      return false;
    }
    this.confirming = false;
    this.confirmChoice = "submit";
    this.slot = Math.max(0, Math.min(INITIALS_LENGTH - 1, slot));
    this.invalidFlashTimer = 0;
    return true;
  }

  getSnapshot() {
    return {
      initials: this.initials,
      slot: this.slot,
      confirming: this.confirming,
      confirmChoice: this.confirmChoice,
      done: this.done,
      blocked: this.blocked,
      invalidFlashSeconds: this.invalidFlashTimer,
    };
  }
}
