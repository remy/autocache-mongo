var store = require('..')();
var cache = require('autocache')({ store: store });

require('autocache/test/core')(cache, finalise);

function finalise(t) {
  t.test('finalise', function (t) {
    store.client.close();
    t.pass('mongodb closed');
    t.end();
  });
}