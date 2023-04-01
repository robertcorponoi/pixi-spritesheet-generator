#!/usr/bin/env node

import ora from "ora";
import path from "path";
import { promises as fsPromises } from "fs";

import shell from "shelljs";
import rimraf from "rimraf";
import { program } from "@commander-js/extra-typings";

import { getImageDimensions } from "./utils.js";

/**
 * The structure of each individual frame of the sprite sheet. This is used as
 * the type for the `frames` property of the JSON file.
 */
type SpriteSheetJSONFrame = {
    [key: string]: {
        frame: {
            x: number;
            y: number;
            w: number;
            h: number;
        };
        spriteSourceSize: {
            x: number;
            y: number;
            w: number;
            h: number;
        };
        sourceSize: {
            w: number;
            h: number;
        };
        anchor: {
            x: number;
            y: number;
        };
    };
};

/**
 * The structure of the JSON data file that is generated that describes the
 * placement and dimensions of each sprite in the spritesheet.
 *
 * This also includes metadata such as the name of the spritesheet, its
 * dimensions, and the name of our CLI which generated it.
 */
type SpriteSheetJSON = {
    meta: {
        app: string;
        version: string;
        format: string;
        image: string;
        size: {
            w: number;
            h: number;
        };
        scale: string;
    };
    frames: SpriteSheetJSONFrame;
    animations: { [key: string]: string[] };
};

program
    .version("0.3.0")
    .description("A CLI to create a spritesheet from a set of sprites.")
    .argument("<input...>", "The sprites to include in the spritesheet.")
    .option("-n, --name <name>", "The name of the generated spritesheet.")
    .option(
        "-o, --output <path>",
        "The path to the directory where the spritesheet and data file will be saved.",
        process.cwd(),
    )
    .option(
        "-t, --trim",
        "Indicates whether transparent whitespace around the sprites should be trimmed or not.",
        false,
    )
    .option(
        "-c, --columns <number>",
        "The number of columns in the spritesheet. If not provided, the spritesheet will be a single column.",
        "1",
    )
    .option(
        "-d, --declaration",
        "Indicates whether a types file should be generated or not. These types include the values of the spritesheet and separate union types of the sprites and animations.",
        false,
    )
    .action(async (input, options) => {
        const spinner = ora({ stream: process.stdout });

        // The input files are passed as an array so we join them so that we
        // can pass them to ImageMagick.
        const inputFiles = input.join(" ");

        // If the name option wasn't passed, we name the spritesheet after the
        // first sprite in the list.
        const name = options.name || input[0];

        // Determines what to pass to the `-tiled` option.
        const spriteCount = input.length;
        const columns = parseInt(options.columns);
        const tiles = `${options.columns}x${Math.round(spriteCount / columns)}`;

        // Keeps track of the position where each sprite should be placed in
        // the `map` function below.
        let xOffset = 0;
        let yOffset = 0;

        // Keeps track of the current column that we are placing the sprite in.
        let currentColumn = 1;

        // Keeps track of the tallest sprite in a row so that when we go to a
        // new row, we can make sure that sprites in that row are placed below
        // the tallest sprite in the previous row.
        let tallestSpriteInRowHeight = 0;

        spinner.start();

        // Keeps track of any animations in the spritesheet. The way we do
        // this is outlined below.
        const animations: { [key: string]: string[] } = {};

        const spritePlacement = input.map((inputFile) => {
            const spriteNameParsed = path.parse(inputFile);

            spinner.text = `Getting sprite position, dimensions, and animations for ${spriteNameParsed.base}...`;
            spinner.render();

            const spriteDimensions = getImageDimensions(inputFile);

            // Calculate the `x` and `y` positions for the sprite before we
            // update any variables that are used to calculate the next
            // sprite's position.
            const x = xOffset;
            const y = yOffset;

            // If the sprite's height is taller than the tallest sprite in
            // the row, update `tallestSpriteInRowHeight` to reflect that.
            if (spriteDimensions.height > tallestSpriteInRowHeight) {
                tallestSpriteInRowHeight = spriteDimensions.height;
            }

            currentColumn++;
            if (currentColumn > columns) {
                currentColumn = 1;

                // Since we're moving on to a new row, we need to increment the
                // `yOffset` to account for the height of the previous row,
                // which is the height of the tallest sprite in it.
                yOffset += tallestSpriteInRowHeight;
                tallestSpriteInRowHeight = 0;

                // Also reset the `xOffset` since we're moving to the next row.
                xOffset = 0;
            } else {
                // Increment the `xOffset` to account for the sprite being added
                // to the row.
                xOffset += spriteDimensions.width;
            }

            // Next, we create the `animations` section of the data file.
            // First, we get the name of the sprite without the extension by
            // splitting on common delimiters (hyphens, underscores, and spaces).
            const spriteNameNoExtension = spriteNameParsed.name;
            const spriteNameSplit = spriteNameNoExtension.split(/(?:-|_| )+/g);

            if (spriteNameSplit.length) {
                const spriteLastElement =
                    spriteNameSplit[spriteNameSplit.length - 1];

                if (spriteLastElement) {
                    // We consider the sprite an animation if it has a number
                    // as the last element in its name.
                    const spriteIsAnimation =
                        spriteLastElement.match(/^[0-9]+$/);

                    if (spriteIsAnimation) {
                        // Animations are the name of the animation without
                        // numbers or the extension so we combine all the
                        // parts of the sprite name except for the last one,
                        // which is the number.
                        const spriteAnimationName = spriteNameSplit
                            .slice(0, -1)
                            .join("-");

                        const spriteHasAnimationEntry =
                            animations[spriteAnimationName];

                        // If the sprite doesn't already have an entry in the
                        // `animations` object, we create one. Otherwise, we
                        // add the sprite to the existing entry.
                        if (!spriteHasAnimationEntry) {
                            animations[spriteAnimationName] = [
                                spriteNameParsed.base,
                            ];
                        } else {
                            animations[spriteAnimationName] = [
                                ...animations[spriteAnimationName],
                                spriteNameParsed.base,
                            ];
                        }
                    }
                }
            }

            return {
                x,
                y,
                name: spriteNameParsed.base,
                width: spriteDimensions.width,
                height: spriteDimensions.height,
            };
        });

        // If the user wants the sprites trimmed, we create a temporary
        // directory to store the trimmed sprites.
        const trimmedSpritesDir = path.join(process.cwd(), `${name}_trimmed`);
        if (options.trim) {
            spinner.text = "Trimming sprites...";
            await fsPromises.mkdir(trimmedSpritesDir);

            // Run the ImageMagick `trim` command to trim the images and save
            // them to the temporary directory.
            shell.exec(
                `magick ${inputFiles} -trim +repage -set filename:base "%[basename]" "${path.join(
                    trimmedSpritesDir,
                    "%[filename:base].png",
                )}"`,
            );
        }

        // Run the montage command with the options specified to generate the
        // spritesheet html file which we'll use to create the JSON.
        spinner.text = "Creating spritesheet...";
        const spritesheetOutput = path.join(options.output, `${name}.png`);
        shell.exec(
            `magick montage ${
                options.trim ? `"${trimmedSpritesDir}/*.*"` : inputFiles
            } -mode Concatenate${
                tiles !== null ? ` -tile ${tiles}` : ""
            } -background transparent "${spritesheetOutput}"`,
        );

        // The dimensions of the spritesheet that was created.
        const spritesheetDimensions = getImageDimensions(spritesheetOutput);

        // Creates the JSON data file and writes it to the output directory.
        spinner.text = "Creating JSON data file...";
        const jsonData: SpriteSheetJSON = {
            meta: {
                app: "pixi-spritesheet-generator",
                version: "0.1.0",
                image: `${name}.png`,
                format: "RGBA8888",
                size: {
                    w: spritesheetDimensions.width,
                    h: spritesheetDimensions.height,
                },
                scale: "1",
            },
            animations,
            frames: spritePlacement.reduce((acc, sprite) => {
                return {
                    ...acc,
                    [sprite.name]: {
                        frame: {
                            x: sprite.x,
                            y: sprite.y,
                            w: sprite.width,
                            h: sprite.height,
                        },
                        rotated: false,
                        trimmed: false,
                        spriteSourceSize: {
                            x: 0,
                            y: 0,
                            w: sprite.width,
                            h: sprite.height,
                        },
                        sourceSize: {
                            w: sprite.width,
                            h: sprite.height,
                        },
                        anchor: {
                            x: 0.5,
                            y: 0.5,
                        },
                    },
                };
            }, {}),
        };
        await fsPromises.writeFile(
            path.join(options.output, `${name}.json`),
            JSON.stringify(jsonData, null, 4),
            "utf-8",
        );

        if (options.declaration) {
            spinner.text = "Creating TypeScript types...";

            const typesData = `\
export type Sprite = ${Object.keys(jsonData.frames)
                .map((frame) => `"${frame}"`)
                .join(" | ")}

export type Animation = ${Object.keys(animations)
                .map((animation) => `"${animation}"`)
                .join(" | ")};

export type SpritesheetData = {
    meta: ${JSON.stringify(jsonData.meta, null, 8)};
    frames: ${JSON.stringify(jsonData.frames, null, 8)};
    animations: ${JSON.stringify(animations, null, 8)};
}`;
            await fsPromises.writeFile(
                path.join(options.output, `${name}.d.ts`),
                typesData,
                "utf-8",
            );
        }

        if (options.trim) await rimraf(trimmedSpritesDir);

        spinner.stop();
    })
    .parse();
