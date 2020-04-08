# blog.skouf.com

## Usage

To run Hugo commands:

```
$ docker-compose run hugo <your command>
```

To run a local, live-reloading version of the site

```
$ docker-compose up local
```

To interact with the bundled `skouf` theme

```
$ docker-compose run theme
```

This will drop you into a shell inside a node container, with the theme mounted at `/app`

From here, you probably want to

```
# Install dependencies
$ yarn install

# Build scss files using gulp
$ yarn exec gulp style
```
