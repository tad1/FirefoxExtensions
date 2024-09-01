#!/usr/bin/env python
import argparse, argcomplete
import json
import logging
import os
import socket
import time

from multiprocessing import Process
from run_firefox import run_firefox, get_free_tcp_port, _profile_name
from typing import Iterable, NamedTuple
from watchdog.events import FileSystemEventHandler
from watchdog.observers import Observer

def dictToMsg(dict: dict) -> str:
    string = json.dumps(dict).replace(' ', '')
    return f"{len(string)}:{string}"
    

def sendMsg(socket: socket.socket, req: dict):
    msg = dictToMsg(req)
    socket.send(msg.encode())
    logging.info(f"sent: {msg}")

def rcvMsg(socket: socket.socket):
    resp = ''
    num_buffer = bytearray()
    MAX_NUM_BUFF_SIZE = 10
    try:
        char = socket.recv(1)[0]
        n_char = 0
        while char != ord(':'):
            num_buffer.append(char)
            char = socket.recv(1)[0]
            n_char += 1
            if(n_char >= MAX_NUM_BUFF_SIZE):
                raise "[rcvMsg]: bad input"
        
        expected_bytes = int(num_buffer.decode())

        resp = socket.recv(expected_bytes)
        resp = resp.decode()
        
    finally:
        logging.debug(resp)
        resp = json.loads(resp)
        return resp

class AddonDestriptor(NamedTuple):
    path: str
    id: str
    object: str
    actor: str

class FirefoxAddonsController():
    addonsDescriptors : dict[str, AddonDestriptor] = {}
    initalized = False
    port : int = None
    paths : str|Iterable[str] = None
    addonsActor : str = None
    connected = False
    CONNECTION_TIMEOUT : int = 0.4

    def __init__(self, port, paths : str|list[str]) -> None:
        self.port = port
        self.paths = [paths] if type(paths) is str else paths
        self.soc = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    
    def _try_connect(self):
        res = self.soc.connect_ex(("127.0.0.1", self.port))
        self.connected = True if res == 0 else False
        if(res != 0):
            logging.info(f"[FirefoxAddonsController] connection refused for 127.0.0.1:{self.port}")
        else:
            logging.info(f"[FirefoxAddonsController] connected to remote debugger at 127.0.0.1:{self.port}")

    def init(self):
        while(not self.connected):
            self._try_connect()
            time.sleep(self.CONNECTION_TIMEOUT)

        for path in self.paths:
            self.installTempAddon(path)

    def _setAddonsActor(self):
        assert self.connected is True

        sendMsg(self.soc, {'to': 'root', 'type': 'getRoot'})
        rcvMsg(self.soc) # ignore first response
        root = rcvMsg(self.soc)
        if(root['addonsActor']):
            self.addonsActor = root['addonsActor']

    def installTempAddon(self, path):
        path = os.path.abspath(path)
        assert self.connected is True
        
        if(self.addonsActor is None):
            self._setAddonsActor()

        sendMsg(self.soc, {'to': self.addonsActor, 'type': 'installTemporaryAddon', 'addonPath': path, 'openDevTools':'true'})
        resp = rcvMsg(self.soc) # ignore {'from': 'root', 'type': 'addonsChanged'}
        while('addon' not in resp):
            resp = rcvMsg(self.soc)

        logging.debug(resp)
        
        assert resp['addon'] is not None
        
        logging.info(f"installed temporary addon from: {path}")

        addon = resp['addon']
        id = addon['id']

        sendMsg(self.soc, {'to': 'root', 'type':'listAddons'})
        resp = rcvMsg(self.soc)
        addon_iterator = filter(lambda obj : obj['id'] == id, resp['addons'])
        addon = next(addon_iterator)
        self.addon = addon
        self.addonsDescriptors[path] = AddonDestriptor(path, id, addon, addon['actor'])

    def reload(self, path):
        if(self.addonsDescriptors[path]):
            sendMsg(self.soc, {'to': self.addonsDescriptors[path].actor, 'type': 'reload'})


class WatchdogHandler(FileSystemEventHandler):
    addonController : FirefoxAddonsController    
    path : str
    def __init__(self, addonController, path) -> None:
        super().__init__()
        self.addonController = addonController
        self.path = path

    def on_closed(self, event):
        if(os.path.abspath(event.src_path).startswith(os.path.join(os.getcwd(), _profile_name))):
            return
        logging.info(event)
        print(f"[FSWatchdog] modified file: {event.src_path}")
        self.addonController.reload(self.path)
        

def main(paths=[os.getcwd()]):
    port = get_free_tcp_port()
    addonController = FirefoxAddonsController(port, paths=paths)

    watchdogs : list[Observer] = []
    for path in paths:
        wdgHanlder = WatchdogHandler(addonController, path)
        observer = Observer()
        observer.schedule(event_handler=wdgHanlder, path=path, recursive=True)
        watchdogs.append(observer)


    firefox = Process(target=lambda: run_firefox(port))
    firefox.start()
    addonController.init()
    [observer.start() for observer in watchdogs]
    try:
        firefox.join()
    except KeyboardInterrupt:
        # I have no idea; why this works. 
        # It appears that simply ignoring KeyboardInterrupt sends the signal to the firefox process
        pass 
    print("closed firefox!")
    [observer.stop() for observer in watchdogs]
    print("finished!")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument('path', type=str, nargs="*", default=[os.getcwd()])
    parser.add_argument('--log', type=str, required=False, default="WARNING", choices=["DEBUG", "INFO", "WARNING", "WARN", "ERROR", "CRITICAL"])
    argcomplete.autocomplete(parser)
    args = parser.parse_args()

    log_numeric_level = getattr(logging, args.log)
    logging.basicConfig(level=log_numeric_level)
    main(paths=args.path)