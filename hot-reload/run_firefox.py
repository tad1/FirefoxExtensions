import os
import shutil
import subprocess
import socket
import traceback
import logging
import sys

_user_settings = "user.js"
_profile_name = "firefox-hot-reload-profile"
_firefox_bin = "firefox"
_default_user_js = """
// those 2 are required to enable remote controll
user_pref("devtools.chrome.enabled", true);
user_pref("devtools.debugger.remote-enabled", true);
// this is one is optional; basically QoL
user_pref("devtools.debugger.prompt-connection", false);

// removes Privacy Notice tab
user_pref("toolkit.telemetry.reportingpolicy.firstRun", false);
// remove Welcome tab
user_pref("startup.homepage_welcome_url", "about:blank");
// remove distro default homepage
user_pref("browser.startup.homepage", "about:blank");
// remove Manjaro bookmarks (example)
user_pref("distribution.Manjaro.bookmarksProcessed", true);
"""
_cwd = os.getcwd()


def get_free_tcp_port():
    tcp = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    tcp.bind(('', 0))
    _, port = tcp.getsockname()
    tcp.close()
    return port

def run_firefox(debugger_port):
    try:
        os.mkdir(_profile_name)
    except FileExistsError:
        pass
    try:
        with open(os.path.join(_profile_name, "user.js"), "w") as profile:
            profile.write(_default_user_js)
            try:
                with open(_user_settings) as config:
                    print(f"found {_user_settings}")
                    shutil.copyfileobj(config, profile)
            except:
                pass
        

        print(f"running firefox with debugger, at localhost:{debugger_port}")
        subprocess.run([_firefox_bin, "-profile", os.path.join(_cwd, _profile_name), "--foreground", "--no-remote",  "--start-debugger-server", f"{debugger_port}"])
    except KeyboardInterrupt:
        print("Exception!")
        pass
    except Exception:
        traceback.print_exc(file=sys.stdout)
    print("clearing!")
    shutil.rmtree(_profile_name)
    sys.exit(0)

if __name__ == "__main__":
    port = get_free_tcp_port()
    run_firefox(port)