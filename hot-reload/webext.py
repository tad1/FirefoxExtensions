#!/usr/bin/env python
import argparse, argcomplete
import json
import logging
import os
import shutil

import hot_reload

def handle_new(args):
    dst = os.path.join(os.getcwd(), args.name)
    src = os.path.join(os.path.dirname(os.path.abspath(__file__)), "project-template")
    shutil.copytree(src, dst, dirs_exist_ok=True)

def handle_run(args):
    log_numeric_level = getattr(logging, args.log)
    logging.basicConfig(level=log_numeric_level)
    hot_reload.main(paths=args.path, clear=(not args.n))

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    command_subparser = parser.add_subparsers(dest='command', required=False)
    parser_run = command_subparser.add_parser('run')
    parser_new = command_subparser.add_parser('new')
    command_subparser.default

    parser_run.add_argument('path', type=str, nargs="*", default=[os.getcwd()])
    parser_run.add_argument('--log', type=str, required=False, default="WARNING", choices=["DEBUG", "INFO", "WARNING", "WARN", "ERROR", "CRITICAL"])
    parser_run.add_argument('-n', action='store_true')
    parser_run.set_defaults(func=handle_run)
    

    parser_new.add_argument('name', type=str)
    parser_new.set_defaults(func=handle_new)
    argcomplete.autocomplete(parser)
    args = parser.parse_args()

    if args.command is None:
        args = parser_run.parse_args()
        handle_run(args)
    else:
        args.func(args)