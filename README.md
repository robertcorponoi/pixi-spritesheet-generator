# Pixi Spritesheet Generator

Generate a spritesheet with a png and a JSON data file from a set of
individual sprites that can be used with [PixiJS](https://pixijs.com/).

**Note:** Pixi Spritesheet Generator is still in beta. I'm currently using it
for my projects but expect to run into issues. Please report any issues and
they will be addressed.

## Install

```sh
npm install pixi-spritesheet-generator
```

## Usage

To generate a spritesheet, you just need to call the command with the sprites
to use to generate the spritesheet:

```sh
pixi-spritesheet-generator sprite-01.png sprite-02.png sprite-03.png
```

Or you can use a glob pattern:

```sh
pixi-spritesheet-generator *.png
```

Also, the following options can be passed:

| Option            | Description                                                                                                                                                          | Default Value |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------- |
| -o, --output      | The path to the directory where the spritesheet and data file will be saved.                                                                                         | process.cwd() |
| -t, --trim        | Indicates whether transparent whitespace around the sprites should be trimmed or not. Note that trimming still needs some work and might be buggy.                   | false         |
| -c, --columns     | The number of columns in the spritesheet. If not provided, the spritesheet will be a single column.                                                                  | 1             |
| -d, --declaration | Indicates whether a types file should be generated or not. These types include the values of the spritesheet and separate union types of the sprites and animations. | false         |

To use the spritesheet in Pixi, see the [Pixi Spritesheet Documentation](https://pixijs.download/dev/docs/PIXI.Spritesheet.html).

## License

[MIT](./LICENSE)
