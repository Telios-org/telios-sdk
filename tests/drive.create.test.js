const tape = require('tape');
const _test = require('tape-promise').default;
const test = _test(tape);
const fs = require('fs');
const path = require('path');
const del = require('del');
const { Drive, Account } = require('..');

const { secretBoxKeypair: keyPair } = Account.makeKeys();
const { secretBoxKeypair: keyPair2 } = Account.makeKeys();
const { secretBoxKeypair: keyPair3 } = Account.makeKeys();

let drive;
let drive2;
let drive3;
let encKey;
let encHeader;
let hyperFiles = [];

test('Drive - Create', async t => {

  if(fs.existsSync(path.join(__dirname, '/drive'))) {
    await del([
      path.join(__dirname, '/drive')
    ])
  }

  if(fs.existsSync(path.join(__dirname, '/drive3'))) {
    await del([
      path.join(__dirname, '/drive3')
    ])
  }

  if(fs.existsSync(path.join(__dirname, '/peer-drive'))) {
    await del([
      path.join(__dirname, '/peer-drive')
    ])
  }

  drive = new Drive(__dirname + '/drive', null, { keyPair });

  await drive.ready();

  t.ok(drive.publicKey, `Drive has public key ${drive.publicKey}`);
  t.ok(drive.keyPair, `Drive has peer keypair`);
  t.ok(drive.db, `Drive has Hyperbee DB`);
  t.ok(drive.drivePath, `Drive has path ${drive.drivePath}`);
  t.equals(true, drive.opened, `Drive is open`);

  t.end();
});

test('Drive - Upload Local Encrypted File', async t => {
  t.plan(6);

  try {

    drive.on('file-add', (file, opts) => {
      if(file.encrypted && opts) {
        t.ok(file, 'Emitted file-add with file obj');
        t.ok(opts, 'Emitted file-add with encryption obj');
      }
    });

    const readStream = fs.createReadStream(path.join(__dirname, '/data/raw.email'));
    let { key, header, file } = await drive.writeFile({
                                  filePath: '/email/rawEmailEncrypted.eml', 
                                  readStream, 
                                  encrypted: true 
                                });
    
    encKey = key;
    encHeader = header;
    hyperFiles.push({ hash: file.hash })

    t.ok(key, `File was encrypted with key`);
    t.ok(header, `File was encrypted with header`);
    t.ok(file.hash, `Hash of file was returned ${file.hash}`);
    t.ok(file.size, `Size of file in bytes was returned ${file.size}`);
  } catch(e) {
    t.error(e);
  }
});

test('Drive - Read Local Encrypted File', async t => {
  t.plan(1);
  const stream = await drive.readFile('/email/rawEmailEncrypted.eml');
  let encryptedMessage = '';

  stream.on('data', chunk => {
    encryptedMessage += chunk.toString('utf-8');
  });

  stream.on('end', () => {
    t.ok(encryptedMessage.length, 'Returned encrypted data');
  })
});

test('Drive - Read and Decipher Encrypted File', async t => {
  t.plan(1);
  const origFile = fs.readFileSync(path.join(__dirname, '/data/raw.email'), { encoding: 'utf-8' });
  const stream = await drive.readFile('/email/rawEmailEncrypted.eml', { key: encKey, header: encHeader });
  let decrypted = '';

  stream.on('data', chunk => {
    decrypted += chunk.toString('utf-8');
  });

  stream.on('end', () => {
    t.equals(origFile, decrypted, 'Decrypted file matches original');
  })
});

test('Drive - Create Seed Peer', async t => {
  t.plan(2);

  drive2 = new Drive(__dirname + '/peer-drive', drive.db.feed.key.toString('hex'), { keyPair: keyPair2 });
  await drive2.ready();

  const readStream = fs.createReadStream(path.join(__dirname, '/data/test.doc'));
  await drive.writeFile({
    filePath: '/email/test.doc', 
    readStream
  });

  drive2.on('file-download', async (err, file) => {
    if(err) return t.error(err);

    if(file.encrypted) {
      const stream = await drive2.readFile(file.path, { key: encKey, header: encHeader });

      let decrypted = '';

      stream.on('data', chunk => {
        decrypted += chunk.toString('utf-8');
      });

      stream.on('end', () => {
        t.ok(decrypted.length);
      })
    } else {
      t.ok(file, `${JSON.stringify(file)}`);
    }
  });
});

test('Drive - Fetch Files from Remote Drive', async t => {
  t.plan(2);

  drive3 = new Drive(__dirname + '/drive3', null, { keyPair: keyPair3 });
  
  await drive3.ready();

  drive3.download(drive.discoveryKey, hyperFiles);

  drive3.on('file-download', (err, file) => {
    if(err) return t.error(err);
    
    t.ok(file, `File downloaded from remote peer`);
  });

  drive3.on('download-finished', () => {
    t.ok(1, 'All files finished downloading!');
  });

  drive3.on('download-error', err => {
    t.error(err);
  });
});

test('Drive - Unlink Local File', async t => {
  t.plan(2);

  drive.on('file-unlink', path => {
    t.ok(path, `Drive File deleted`);
  });

  drive2.on('file-unlink', path => {
    t.ok(path, `Drive2 File removed from remote`);
  })

  await drive.unlink('/email/rawEmailEncrypted.eml');
});

test.onFinish(async () => {
  process.exit(0);
});
