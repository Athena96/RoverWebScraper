

const fs = require("fs");

 const writeFile = (filename, content) => {
    try {
        fs.writeFileSync(filename, content);
        console.log(`The file ${filename} has been saved!`);
    } catch (err) {
        console.error(err);
    }
}

module.exports = { writeFile };
