from __future__ import annotations

import shutil
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
APP_DIR = REPO_ROOT / "cat-sword-climb"
BUILD_WEB_DIR = APP_DIR / "build" / "web"
TARGET_DIRS = (REPO_ROOT / "docs", REPO_ROOT / "web")
SPLASH_ASSET = APP_DIR / "assets" / "splash_over_the_moon.png"
PROMPT_HTML = """<div class="infobox-subtitle">PRESS SPACEBAR TO START</div>
<div class="infobox-controls">
    <div>ARROWS MOVE</div>
    <div>SPACE JUMP / DOWNSLASH</div>
    <div>R RESTARTS AFTER FALLEN</div>
</div>"""

LOADING_HTML = """<div class="infobox-subtitle">LOADING</div>
<div class="infobox-note">INSTALLING {pkg.upper()}</div>"""

STATUS_BLOCK = """        #status {
            display: inline-block;
            vertical-align: top;
            margin-top: 20px;
            margin-left: 0;
            font-weight: bold;
            color: #f6f7ef;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            text-shadow: 0 2px 0 #111827;
        }
"""

PROGRESS_BLOCK = """        #progress {
            height: 12px;
            width: 260px;
            accent-color: #78d9ff;
        }
"""

INFOBOX_BLOCK = """        #infobox {
            position: fixed;
            background: rgba(9, 14, 29, 0.84);
            color: #f6f7ef;
            font-weight: bold;
            padding: 14px 20px 16px;
            border: 3px solid rgba(120, 217, 255, 0.82);
            border-radius: 16px;
            box-shadow: 0 18px 60px rgba(0, 0, 0, 0.45);
            z-index: 999999;
            text-transform: uppercase;
            letter-spacing: 0.10em;
            text-align: center;
            min-width: min(340px, calc(100vw - 40px));
        }

        .infobox-title {
            font-size: 22px;
            line-height: 1;
            margin-bottom: 8px;
            text-shadow: 0 3px 0 #18233d;
        }

        .infobox-subtitle {
            color: #ffe07a;
            font-size: 13px;
            margin-bottom: 12px;
        }

        .infobox-controls {
            display: flex;
            flex-direction: column;
            gap: 7px;
            color: #d7edf7;
            font-size: 12px;
        }

        .infobox-note {
            color: #d7edf7;
            font-size: 11px;
        }
"""

CANVAS_BLOCK = """        canvas.emscripten {
            border: 0px none;
            background-color: transparent;
            width: min(100dvw, calc(var(--app-height, 100dvh) * 0.675));
            height: min(var(--app-height, 100dvh), calc(100dvw / 0.675));
            z-index: 5;

            padding: 0;
            margin: 0 auto;

            position: absolute;
            top: 0;
            bottom: 0;
            left: 0;
            right: 0;
        }

        canvas.emscripten:focus {
            outline: none;
        }

        body.splash-active canvas.emscripten {
            opacity: 0;
        }
"""

BODY_BLOCK = """        html,
        body {
            width: 100%;
            height: 100%;
            height: var(--app-height, 100dvh);
            overflow: hidden;
            overscroll-behavior: none;
            touch-action: none;
            -webkit-user-select: none;
            user-select: none;
            -webkit-touch-callout: none;
        }

        body {
            font-family: "Trebuchet MS", Verdana, sans-serif;
            margin: 0;
            padding: 0;
            background:
                linear-gradient(180deg, rgba(4, 7, 18, 0.08), rgba(4, 7, 18, 0.18)),
                url("splash_over_the_moon.png") center center / cover no-repeat,
                #050814;
            color: #f6f7ef;
            position: fixed;
            inset: 0;
        }

        body.game-active {
            background: #091020;
        }

        @media (min-aspect-ratio: 4 / 3) {
            body.splash-active {
                background:
                    linear-gradient(180deg, rgba(4, 7, 18, 0.12), rgba(4, 7, 18, 0.22)),
                    url("splash_over_the_moon.png") center center / contain no-repeat,
                    #050814;
            }
        }
"""

FOCUS_JS = """        const blockedKeys = new Set([
            "ArrowUp",
            "ArrowDown",
            "ArrowLeft",
            "ArrowRight",
            "Up",
            "Down",
            "Left",
            "Right",
            " ",
            "Spacebar",
            "r",
            "R",
            "p",
            "P",
        ]);

        const setSplashActive = () => {
            const isWaitingForStart = !(window.MM && window.MM.UME);
            document.body.classList.toggle("splash-active", isWaitingForStart);
            document.body.classList.toggle("game-active", !isWaitingForStart);
        };
        const revealGameCanvas = () => {
            document.body.classList.remove("splash-active");
            document.body.classList.add("game-active");
        };
        setSplashActive();

        const focusCanvas = () => {
            canvas.setAttribute("tabindex", "0");
            if (typeof window.focus === "function") {
                window.focus();
            }
            try {
                canvas.focus({ preventScroll: true });
            } catch (_error) {
                canvas.focus();
            }
        };
        window.focusCanvas = focusCanvas;

        ;["click", "mousedown", "touchstart"].forEach((eventName) => {
            canvas.addEventListener(eventName, () => {
                focusCanvas();
                if (window.MM && !window.MM.UME) {
                    window.MM.UME = true;
                }
                revealGameCanvas();
            }, { passive: true });
            document.addEventListener(eventName, () => {
                focusCanvas();
                if (window.MM && !window.MM.UME) {
                    window.MM.UME = true;
                }
                revealGameCanvas();
            }, { passive: true });
        });

        window.addEventListener("keydown", (event) => {
            if (blockedKeys.has(event.key)) {
                event.preventDefault();
                focusCanvas();
                if ((event.key === " " || event.key === "Spacebar") && window.MM && !window.MM.UME) {
                    window.MM.UME = true;
                    revealGameCanvas();
                }
            }
        }, { capture: true });

        window.addEventListener("keyup", (event) => {
            if (blockedKeys.has(event.key)) {
                event.preventDefault();
                focusCanvas();
            }
        }, { capture: true });
"""

MOBILE_BROWSER_JS = """        const setAppHeight = () => {
            const viewportHeight = window.visualViewport ? window.visualViewport.height : window.innerHeight;
            document.documentElement.style.setProperty("--app-height", `${viewportHeight}px`);
        };
        setAppHeight();
        window.addEventListener("resize", setAppHeight);
        window.addEventListener("orientationchange", setAppHeight);
        if (window.visualViewport) {
            window.visualViewport.addEventListener("resize", setAppHeight);
            window.visualViewport.addEventListener("scroll", setAppHeight);
        }

        const preventBrowserGesture = (event) => {
            event.preventDefault();
        };
        document.addEventListener("contextmenu", preventBrowserGesture, { capture: true });
        document.addEventListener("touchmove", preventBrowserGesture, { passive: false });
        ;["gesturestart", "gesturechange", "gestureend"].forEach((eventName) => {
            window.addEventListener(eventName, preventBrowserGesture, { passive: false });
        });
"""


def replace_once(text: str, old: str, new: str) -> str:
    if new and new in text:
        return text
    if old not in text:
        raise RuntimeError(f"Expected snippet not found while patching:\n{old[:120]}")
    return text.replace(old, new, 1)


def patch_index_html(html: str) -> str:
    html = replace_once(html, "<title>cat-sword-climb</title>", "<title>Cow Sword Climb</title>")
    html = replace_once(
        html,
        '    <meta name="viewport" content="width=device-width, initial-scale=1.0">\n',
        '    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">\n',
    )
    html = replace_once(
        html,
        '    <meta name="viewport" content="height=device-height, initial-scale=1.0">\n',
        "",
    )
    html = replace_once(
        html,
        '    platform.document.body.style.background = "#7f7f7f"\n',
        '    platform.document.body.style.background = ""\n',
    )
    html = replace_once(
        html,
        '        msg  = "Ready to start ! Please click/touch page"\n        platform.window.infobox.innerText = msg\n',
        f'        msg  = """\n{PROMPT_HTML}\n"""\n        platform.window.infobox.innerHTML = msg\n',
    )
    html = replace_once(
        html,
        '        platform.window.infobox.innerText = f"installing {pkg}"\n',
        f'        platform.window.infobox.innerHTML = f"""\n{LOADING_HTML}\n"""\n',
    )
    html = replace_once(
        html,
        """        #status {
            display: inline-block;
            vertical-align: top;
            margin-top: 20px;
            margin-left: 30px;
            font-weight: bold;
            color: rgb(120, 120, 120);
        }
""",
        STATUS_BLOCK,
    )
    html = replace_once(
        html,
        """        #progress {
            height: 20px;
            width: 300px;
        }
""",
        PROGRESS_BLOCK,
    )
    html = replace_once(
        html,
        """        #infobox {
            position: fixed; /* center relative to viewport */
            background: green;
            color: blue;
            font-weight: bold;
            padding: 12px 24px;
 /*           display: none; */
            z-index: 999999;
        }
""",
        INFOBOX_BLOCK,
    )
    html = replace_once(
        html,
        """        canvas.emscripten {
            border: 0px none;
            background-color: transparent;
            width: 100%;
            height: 100%;
            z-index: 5;

            padding: 0;
            margin: 0 auto;

            position: absolute;
            top: 0;
            bottom: 0;
            left: 0;
            right: 0;
        }
""",
        CANVAS_BLOCK,
    )
    html = replace_once(
        html,
        """        body {
            font-family: arial;
            margin: 0;
            padding: none;
            background-color:powderblue;
        }
""",
        BODY_BLOCK,
    )
    html = replace_once(
        html,
        "        show_infobox()\n",
        f"        show_infobox()\n\n{FOCUS_JS}\n{MOBILE_BROWSER_JS}",
    )
    return html


def prepare_target(target_dir: Path) -> None:
    if target_dir.exists():
        shutil.rmtree(target_dir)
    shutil.copytree(BUILD_WEB_DIR, target_dir)
    shutil.copy2(SPLASH_ASSET, target_dir / SPLASH_ASSET.name)
    index_path = target_dir / "index.html"
    index_path.write_text(patch_index_html(index_path.read_text()))


def main() -> None:
    if not BUILD_WEB_DIR.exists():
        raise SystemExit(f"Missing build output: {BUILD_WEB_DIR}")
    if not SPLASH_ASSET.exists():
        raise SystemExit(f"Missing splash asset: {SPLASH_ASSET}")

    for target_dir in TARGET_DIRS:
        prepare_target(target_dir)

    print("Prepared web build in docs/ and web/")


if __name__ == "__main__":
    main()
