const simpleParser = require('mailparser').simpleParser;

exports.parser = async (data) => {
  let parsed = await simpleParser(data);
  return parsed;
}