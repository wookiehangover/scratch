# scratch is a personal media server

but its a work in progess...

currently, it will _attempt_ to stream files directly in your browser and offer you streaming links to pop into a player, like VLC.

## TODO:
- figure out WTF is up with the DIVX player not wanting to play anything

## Usage:

symlink some media directories into public/files:

    ln -s /path/to/files movies

and then start the server

    node app.js

and enjoy :D
