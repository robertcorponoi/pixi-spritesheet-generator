import shell from "shelljs";
/**
 * Runs the `magick identify -ping -format "%w %h` command to get the width
 * and height of the provided image.
 *
 * @param {string} imagePath The path to the image to get the dimensions of.
 *
 * @returns {<{width: number, height: number}>} The width and height of the image.
 */
export const getImageDimensions = (imagePath) => {
    const { stdout } = shell.exec(`magick identify -ping -format "%w %h" "${imagePath}"`, { silent: true });
    // The image comes back as a string with the width and height separated by
    // a space, like "20 30". We split the string on the space and convert the
    // strings to numbers.
    const [width, height] = stdout.split(" ");
    return { width: parseInt(width), height: parseInt(height) };
};
