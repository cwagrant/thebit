### Setup

To setup the minish-resizer you'll need to run `npm install` in the directory
you clone the repo to. Afterwards you'll need to create a copy of the
`.env.example` file and name it `.env` to set your parameters. Something like

```shell
cp ./.env.example ./.env
```

Afterwards you'll want to set your environment variables in the newly minted
`.env` file.

### Development

When developing you can use `npm run dev` to run with nodemon to automatically
reload as you make changes to the files.

### Production

To run this in a production capacity you'll need to run it with `npm run start`.
