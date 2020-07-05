#!/usr/bin/env bash
node route_guide/route_guide_server.js &
PID=$!

npm run asrtd:run

kill $PID
