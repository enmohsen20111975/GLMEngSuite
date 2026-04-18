#!/bin/bash
cd /home/z/my-project
exec node --max-old-space-size=1024 node_modules/.bin/next dev -p 3000 --webpack

