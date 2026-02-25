#!/bin/sh
echo "Setting Git hooksPath to .githooks for repository at $(pwd)"
git config core.hooksPath .githooks
echo "Run 'git config --local --get core.hooksPath' to verify."
