mergeInto(LibraryManager.library, {
  DrumSample: function(ptr) {
    var s = JSON.parse(UTF8ToString(ptr));
    window.drumSmash = window.drumSmash || {samples:[]};
    window.drumSmash.latest=s;
    window.drumSmash.samples.push(s);
    if(window.drumSmash.samples.length>2400)window.drumSmash.samples.shift();
  }
});
