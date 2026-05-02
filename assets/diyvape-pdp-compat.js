(function(){
  function chkC(inp){
    var v = inp.value.trim(),
        c = inp.closest('.compat'),
        r = c ? c.querySelector('.compat__res') : null;
    if(!r) return;
    if(v.length < 2){
      r.innerHTML = '';
      r.style.height = '';
      return;
    }
    // Source 3: data-devs (strings planos → objetos sin url)
    var s3 = (c.getAttribute('data-devs') || '').split('|')
              .map(function(d){ return {t: d.trim(), u: null}; })
              .filter(function(x){ return x.t; });
    // Merge: window.diyCompatDevs (objetos {t,u}) + s3
    var base = (window.diyCompatDevs && window.diyCompatDevs.length)
               ? window.diyCompatDevs : [];
    var seen = {}, all = [];
    base.concat(s3).forEach(function(x){
      var k = x.t.toLowerCase();
      if(!seen[k]){ seen[k] = true; all.push(x); }
    });
    if(!all.length){
      r.innerHTML = '';
      r.style.height = '';
      return;
    }
    var q = v.toLowerCase(), h = '', f = 0;
    all.forEach(function(x){
      if(x.t.toLowerCase().indexOf(q) > -1){
        var nameHtml = x.u
          ? '<a href="' + x.u + '" style="color:inherit;text-decoration:underline;text-decoration-color:rgba(0,0,0,0.25);text-underline-offset:3px;cursor:pointer;">'
            + x.t
            + ' <span style="font-size:0.7em;opacity:0.45;vertical-align:middle;">↗</span></a>'
          : '<span>' + x.t + '</span>';
        h += '<div class="compat__item">' + nameHtml
           + '<span class="compat__badge compat__badge--y">Compatible</span></div>';
        f++;
      }
    });
    if(!f){
      h = '<div class="compat__item"><span>No encontrado entre los equipos compatibles</span>'
        + '<span class="compat__badge compat__badge--n">Consultar</span></div>';
    }
    r.style.height = 'auto';
    r.innerHTML = h;
  }
  window.chkC = chkC;
  document.addEventListener('input', function(e){
    if(e.target && e.target.classList.contains('compat__in')){
      chkC(e.target);
    }
  }, true);
})();