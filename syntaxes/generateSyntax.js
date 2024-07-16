const fs = require('fs');
const path = require('path');

const n = 10;  // Set your desired level of nesting

const generateSyntax = (level) => {
  if (level > n) return [];
  
  return [
    {
      "begin": `#ifdef\\b`,
      "beginCaptures": {
        "0": { "name": `keyword.control.preprocessor.ifdef.level${level}` }
      },
      "end": `#endif\\b`,
      "endCaptures": {
        "0": { "name": `keyword.control.preprocessor.endif.level${level}` }
      },
      "patterns": generateSyntax(level + 1)
    }
  ];
};

const syntax = {
  "scopeName": "source.preprocessor",
  "patterns": generateSyntax(1)
};

// Ensure the target directory exists
const dir = path.join(__dirname, ''); //syntaxes
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

const filePath = path.join(dir, 'preprocessor.json');
fs.writeFileSync(filePath, JSON.stringify(syntax, null, 2));
console.log(`Generated preprocessor.json for ${n} levels of nesting. File name ${filePath}`);
