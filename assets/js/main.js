/* Apart Hotel AMTER — interacciones */
(function () {
  'use strict';

  var WA_NUMBER = '59898275131';
  var EMAIL = 'hotelrr@gmail.com';
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  document.documentElement.classList.add('js');

  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }

  function openWhatsApp(text) {
    var url = 'https://wa.me/' + WA_NUMBER + (text ? '?text=' + encodeURIComponent(text) : '');
    window.open(url, '_blank', 'noopener');
  }

  /* ---------- Header ---------- */
  var header = $('#header');
  function onScroll() {
    header.classList.toggle('is-scrolled', window.scrollY > 40);
  }
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  /* ---------- Menú móvil ---------- */
  var burger = $('#burger');
  function setMenu(open) {
    header.classList.toggle('menu-open', open);
    document.body.classList.toggle('is-locked', open);
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
  }
  burger.addEventListener('click', function () {
    setMenu(!header.classList.contains('menu-open'));
  });
  $$('#nav a').forEach(function (a) {
    a.addEventListener('click', function () { setMenu(false); });
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && header.classList.contains('menu-open')) setMenu(false);
  });

  /* ---------- Sección activa en el menú ---------- */
  var navLinks = $$('.nav__list a');
  if ('IntersectionObserver' in window) {
    var sectionObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        navLinks.forEach(function (link) {
          link.classList.toggle('is-active', link.getAttribute('href') === '#' + entry.target.id);
        });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    navLinks.forEach(function (link) {
      var target = $(link.getAttribute('href'));
      if (target) sectionObserver.observe(target);
    });
  }

  /* ---------- Hero ---------- */
  var slides = $$('.hero__slide');
  var dotsWrap = $('.hero__dots');
  var current = 0;
  var timer;

  function showSlide(i) {
    slides[current].classList.remove('is-active');
    dots[current].classList.remove('is-active');
    dots[current].setAttribute('aria-selected', 'false');
    current = (i + slides.length) % slides.length;
    var img = $('img', slides[current]);
    if (img.loading === 'lazy') img.loading = 'eager';
    slides[current].classList.add('is-active');
    dots[current].classList.add('is-active');
    dots[current].setAttribute('aria-selected', 'true');
  }

  var dots = slides.map(function (slide, i) {
    var b = document.createElement('button');
    b.className = 'hero__dot' + (i === 0 ? ' is-active' : '');
    b.type = 'button';
    b.setAttribute('role', 'tab');
    b.setAttribute('aria-selected', i === 0 ? 'true' : 'false');
    b.textContent = slide.dataset.label;
    b.addEventListener('click', function () { showSlide(i); restart(); });
    dotsWrap.appendChild(b);
    return b;
  });

  function restart() {
    clearInterval(timer);
    if (!reduceMotion) timer = setInterval(function () { showSlide(current + 1); }, 6500);
  }
  // Precargar las siguientes fotos sin bloquear la primera
  window.addEventListener('load', function () {
    slides.forEach(function (s) { var img = $('img', s); if (img.loading === 'lazy') img.loading = 'eager'; });
  });
  restart();

  /* ---------- Formulario de reserva ---------- */
  var form = $('#bookingForm');
  var inDate = $('#bk-in');
  var outDate = $('#bk-out');

  function iso(d) {
    var tz = d.getTimezoneOffset() * 60000;
    return new Date(d - tz).toISOString().slice(0, 10);
  }
  function fmt(value) {
    var p = value.split('-');
    return p[2] + '/' + p[1] + '/' + p[0];
  }
  var today = new Date();
  inDate.min = iso(today);
  outDate.min = iso(new Date(today.getTime() + 864e5));

  inDate.addEventListener('change', function () {
    if (!inDate.value) return;
    var next = new Date(inDate.value + 'T12:00:00');
    next.setDate(next.getDate() + 1);
    outDate.min = iso(next);
    if (!outDate.value || outDate.value <= inDate.value) outDate.value = iso(next);
    inDate.closest('.field').classList.remove('is-invalid');
  });
  outDate.addEventListener('change', function () { outDate.closest('.field').classList.remove('is-invalid'); });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var ok = true;
    [inDate, outDate].forEach(function (f) {
      var bad = !f.value;
      f.closest('.field').classList.toggle('is-invalid', bad);
      if (bad) ok = false;
    });
    if (!ok) { (inDate.value ? outDate : inDate).focus(); return; }

    var nights = Math.round((new Date(outDate.value) - new Date(inDate.value)) / 864e5);
    var msg = [
      'Hola! Quisiera consultar disponibilidad en Apart Hotel AMTER.',
      '',
      '• Llegada: ' + fmt(inDate.value),
      '• Salida: ' + fmt(outDate.value) + (nights > 0 ? ' (' + nights + (nights === 1 ? ' noche)' : ' noches)') : ''),
      '• Huéspedes: ' + $('#bk-guests').value,
      '• Habitación: ' + $('#bk-room').value
    ].join('\n');
    openWhatsApp(msg);
  });

  // Botones "Consultar disponibilidad" de cada habitación
  $$('[data-book]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      $('#bk-room').value = btn.dataset.book;
      if (btn.dataset.guests) $('#bk-guests').value = btn.dataset.guests;
      $('#reservar').scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
      setTimeout(function () {
        inDate.focus({ preventScroll: true });
        form.animate && form.animate(
          [{ boxShadow: '0 0 0 0 rgba(199,155,91,.7)' }, { boxShadow: '0 0 0 14px rgba(199,155,91,0)' }],
          { duration: 1100, easing: 'ease-out' }
        );
      }, 650);
    });
  });

  // Enlaces genéricos a WhatsApp
  $$('[data-wa]').forEach(function (el) {
    el.addEventListener('click', function (e) {
      e.preventDefault();
      openWhatsApp(el.dataset.wa);
    });
  });

  // Burbuja del botón flotante
  // Burbuja del botón flotante: aparece una vez, cuando el visitante ya pasó la portada
  var waFloat = $('.wa-float');
  var bubbleShown = false;
  window.addEventListener('scroll', function () {
    if (bubbleShown || window.scrollY < window.innerHeight * 1.2) return;
    bubbleShown = true;
    waFloat.classList.add('show-bubble');
    setTimeout(function () { waFloat.classList.remove('show-bubble'); }, 5000);
  }, { passive: true });

  /* ---------- Carruseles de habitaciones ---------- */
  $$('[data-carousel]').forEach(function (carousel) {
    var track = $('.carousel__track', carousel);
    var slidesEls = $$('.carousel__slide', track);
    var prev = $('.carousel__btn--prev', carousel);
    var next = $('.carousel__btn--next', carousel);
    var currentEl = $('[data-current]', carousel);
    $('[data-total]', carousel).textContent = slidesEls.length;

    function step() { return slidesEls[0].getBoundingClientRect().width + 14; }
    function update() {
      var max = track.scrollWidth - track.clientWidth - 2;
      prev.disabled = track.scrollLeft <= 2;
      next.disabled = track.scrollLeft >= max;
      var idx = Math.round(track.scrollLeft / step());
      if (track.scrollLeft >= max) idx = slidesEls.length - 1;
      currentEl.textContent = Math.min(idx + 1, slidesEls.length);
    }
    prev.addEventListener('click', function () { track.scrollBy({ left: -step(), behavior: 'smooth' }); });
    next.addEventListener('click', function () { track.scrollBy({ left: step(), behavior: 'smooth' }); });
    track.addEventListener('scroll', function () { window.requestAnimationFrame(update); }, { passive: true });
    window.addEventListener('resize', update);
    update();
  });

  /* ---------- Tira de fotos de eventos ---------- */
  $$('[data-strip]').forEach(function (strip) {
    var track = $('.strip__track', strip);
    $$('.strip__btn', strip).forEach(function (btn) {
      btn.addEventListener('click', function () {
        track.scrollBy({ left: Number(btn.dataset.dir) * track.clientWidth * 0.7, behavior: 'smooth' });
      });
    });

    // Arrastrar con el mouse
    var down = false, startX = 0, startLeft = 0, moved = false;
    track.addEventListener('pointerdown', function (e) {
      if (e.pointerType !== 'mouse') return;
      down = true; moved = false; startX = e.clientX; startLeft = track.scrollLeft;
    });
    window.addEventListener('pointermove', function (e) {
      if (!down) return;
      var dx = e.clientX - startX;
      if (Math.abs(dx) > 5) { moved = true; track.classList.add('is-dragging'); }
      track.scrollLeft = startLeft - dx;
    });
    window.addEventListener('pointerup', function () {
      if (!down) return;
      down = false;
      setTimeout(function () { track.classList.remove('is-dragging'); }, 0);
    });
    track.addEventListener('click', function (e) { if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; } }, true);
  });

  /* ---------- Lightbox ---------- */
  var lb = $('#lightbox');
  var lbImg = $('.lightbox__img', lb);
  var lbText = $('.lightbox__text', lb);
  var lbCount = $('.lightbox__count', lb);
  var group = [];
  var index = 0;

  function render() {
    var item = group[index];
    lbImg.style.animation = 'none';
    void lbImg.offsetWidth;
    lbImg.style.animation = '';
    lbImg.src = item.href;
    lbImg.alt = item.alt;
    lbText.textContent = item.caption;
    lbCount.textContent = (index + 1) + ' / ' + group.length;
    // precarga de la siguiente
    var n = group[(index + 1) % group.length];
    if (n) { var pre = new Image(); pre.src = n.href; }
  }
  function openGallery(name, start) {
    group = $$('[data-gallery="' + name + '"]').map(function (a) {
      var img = $('img', a);
      return { href: a.getAttribute('href'), caption: a.dataset.caption || '', alt: img ? img.alt : '' };
    });
    if (!group.length) return;
    index = start || 0;
    render();
    lb.showModal();
    document.body.classList.add('is-locked');
  }
  function syncLock() {
    document.body.classList.toggle('is-locked', !!document.querySelector('dialog[open]'));
  }
  function go(d) { index = (index + d + group.length) % group.length; render(); }

  $$('[data-gallery]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      e.preventDefault();
      var name = a.dataset.gallery;
      var items = $$('[data-gallery="' + name + '"]');
      openGallery(name, items.indexOf(a));
    });
  });
  $$('[data-open-gallery]').forEach(function (btn) {
    btn.addEventListener('click', function () { openGallery(btn.dataset.openGallery, 0); });
  });

  $('.lightbox__prev, .lightbox__nav--prev', lb).addEventListener('click', function () { go(-1); });
  $('.lightbox__nav--next', lb).addEventListener('click', function () { go(1); });
  $('.lightbox__close', lb).addEventListener('click', function () { lb.close(); });
  lb.addEventListener('close', syncLock);
  lb.addEventListener('click', function (e) {
    if (e.target === lb || e.target.classList.contains('lightbox__figure')) lb.close();
  });
  lb.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowLeft') go(-1);
    if (e.key === 'ArrowRight') go(1);
  });
  // Swipe en móviles
  var touchX = null;
  lb.addEventListener('touchstart', function (e) { touchX = e.touches[0].clientX; }, { passive: true });
  lb.addEventListener('touchend', function (e) {
    if (touchX === null) return;
    var dx = e.changedTouches[0].clientX - touchX;
    if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
    touchX = null;
  });

  /* ---------- Artículos ---------- */
  $$('[data-dialog]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var dlg = document.getElementById(btn.dataset.dialog);
      dlg.showModal();
      dlg.scrollTop = 0;
      document.body.classList.add('is-locked');
    });
  });
  $$('dialog.article').forEach(function (dlg) {
    $('.article__close', dlg).addEventListener('click', function () { dlg.close(); });
    dlg.addEventListener('close', syncLock);
    dlg.addEventListener('click', function (e) {
      var r = dlg.getBoundingClientRect();
      var inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
      if (!inside) dlg.close();
    });
  });

  /* ---------- Formulario de contacto ---------- */
  var cForm = $('#contactForm');
  var cError = $('#contactError');
  cForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var via = e.submitter ? e.submitter.value : 'whatsapp';
    var fields = ['#c-name', '#c-contact', '#c-msg'].map(function (s) { return $(s); });
    var ok = true;
    fields.forEach(function (f) {
      var bad = !f.value.trim();
      f.closest('.form-field').classList.toggle('is-invalid', bad);
      if (bad && ok) { f.focus(); ok = false; }
    });
    cError.hidden = ok;
    if (!ok) return;

    var name = $('#c-name').value.trim();
    var contact = $('#c-contact').value.trim();
    var subject = $('#c-subject').value;
    var message = $('#c-msg').value.trim();

    if (via === 'email') {
      var body = message + '\n\n—\n' + name + '\n' + contact;
      window.location.href = 'mailto:' + EMAIL + '?subject=' + encodeURIComponent(subject + ' — ' + name) + '&body=' + encodeURIComponent(body);
    } else {
      openWhatsApp('Hola! Soy ' + name + ' (' + contact + ').\n*' + subject + '*\n\n' + message);
    }
  });
  $$('#contactForm input, #contactForm textarea').forEach(function (f) {
    f.addEventListener('input', function () { f.closest('.form-field').classList.remove('is-invalid'); });
  });

  /* ---------- Parallax suave de la banda ---------- */
  var bandBg = $('.band__bg');
  if (bandBg && !reduceMotion) {
    var band = bandBg.parentElement;
    var ticking = false;
    window.addEventListener('scroll', function () {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(function () {
        var r = band.getBoundingClientRect();
        if (r.bottom > 0 && r.top < window.innerHeight) {
          var p = (r.top + r.height / 2 - window.innerHeight / 2) / window.innerHeight;
          bandBg.style.transform = 'translate3d(0,' + (p * -60).toFixed(1) + 'px,0)';
        }
        ticking = false;
      });
    }, { passive: true });
  }

  /* ---------- Aparición al hacer scroll ---------- */
  var reveals = $$('.reveal');
  if ('IntersectionObserver' in window && !reduceMotion) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        // pequeño escalonado entre hermanos
        var siblings = $$('.reveal', el.parentElement).filter(function (s) { return s.parentElement === el.parentElement; });
        var delay = Math.min(siblings.indexOf(el), 6) * 70;
        el.style.transitionDelay = delay + 'ms';
        el.classList.add('is-visible');
        io.unobserve(el);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    reveals.forEach(function (el) { io.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add('is-visible'); });
  }

  /* ---------- Año ---------- */
  $('#year').textContent = new Date().getFullYear();
})();
