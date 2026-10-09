import './backend.js';

let publicCleanup = null;

function initPublicEnhancements(){
  if(publicCleanup) publicCleanup();
  const cleanups=[];
  const on=(target,type,handler,options)=>{ target?.addEventListener(type,handler,options); if(target) cleanups.push(()=>target.removeEventListener(type,handler,options)); };
  const observers=[];
  publicCleanup=()=>{ cleanups.splice(0).forEach(fn=>fn()); observers.splice(0).forEach(o=>o.disconnect()); publicCleanup=null; };

const body = document.body;
const progress = document.querySelector('.progress span');
const header = document.querySelector('.site-header');
const menuToggle = document.querySelector('.menu-toggle');
const mobileMenu = document.querySelector('.mobile-menu');
const cursor = document.querySelector('.cursor');

// Page progress + header state
const updateScroll = () => {
  const max = document.documentElement.scrollHeight - window.innerHeight;
  progress.style.width = `${max > 0 ? (window.scrollY / max) * 100 : 0}%`;
  header.classList.toggle('scrolled', window.scrollY > 24);
};
on(window,'scroll', updateScroll, { passive: true });
updateScroll();

// Reveal-on-scroll
const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add('is-visible');
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.12 });
  observers.push(observer);
document.querySelectorAll('.reveal').forEach((el, i) => {
  el.style.setProperty('--reveal-delay', `${Math.min(i % 5, 4) * 70}ms`);
  observer.observe(el);
});

// Mobile navigation
const closeMenu = () => {
  mobileMenu.classList.remove('open');
  mobileMenu.setAttribute('aria-hidden', 'true');
  menuToggle.setAttribute('aria-expanded', 'false');
  body.classList.remove('menu-open');
};
on(menuToggle,'click', () => {
  const open = mobileMenu.classList.toggle('open');
  mobileMenu.setAttribute('aria-hidden', String(!open));
  menuToggle.setAttribute('aria-expanded', String(open));
  body.classList.toggle('menu-open', open);
});
document.querySelectorAll('.mobile-menu a').forEach((a) => on(a,'click',closeMenu));

// Smooth anchors with header offset
for (const link of document.querySelectorAll('a[href^="#"]')) {
  on(link,'click', (event) => {
    const id = link.getAttribute('href');
    if (!id || id === '#') return;
    const target = document.querySelector(id);
    if (!target) return;
    event.preventDefault();
    const offset = header.offsetHeight + 10;
    window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY - offset, behavior: 'smooth' });
    history.replaceState(null, '', id);
  });
}

// Magnetic / lift interaction on desktop
if (window.matchMedia('(pointer:fine)').matches) {
  document.querySelectorAll('.button, .nav-cta, .footer-cta, .circle-link').forEach((el) => {
    on(el,'pointermove', (e) => {
      const r = el.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width - 0.5) * 8;
      const y = ((e.clientY - r.top) / r.height - 0.5) * 8;
      el.style.setProperty('--mx', `${x}px`);
      el.style.setProperty('--my', `${y}px`);
    });
    on(el,'pointerleave', () => {
      el.style.setProperty('--mx', '0px');
      el.style.setProperty('--my', '0px');
    });
  });

  document.querySelectorAll('.project-visual').forEach((card) => {
    on(card,'pointermove', (e) => {
      const r = card.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width - 0.5) * 2;
      const y = ((e.clientY - r.top) / r.height - 0.5) * 2;
      card.style.setProperty('--rx', `${y * -2}deg`);
      card.style.setProperty('--ry', `${x * 2}deg`);
      card.style.setProperty('--px', `${x * 10}px`);
      card.style.setProperty('--py', `${y * 10}px`);
    });
    on(card,'pointerleave', () => {
      card.style.setProperty('--rx', '0deg');
      card.style.setProperty('--ry', '0deg');
      card.style.setProperty('--px', '0px');
      card.style.setProperty('--py', '0px');
    });
  });

  if (cursor) {
    on(window,'pointermove', (e) => {
      cursor.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0)`;
    });
    document.querySelectorAll('a, button, summary, .project-visual').forEach((el) => {
      on(el,'mouseenter', () => cursor.classList.add('active'));
      on(el,'mouseleave', () => cursor.classList.remove('active'));
    });
  }
}

// Active navigation indicator
const navLinks = [...document.querySelectorAll('.desktop-nav a')];
const sections = navLinks.map((a) => document.querySelector(a.getAttribute('href'))).filter(Boolean);
const sectionObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    navLinks.forEach((a) => a.classList.toggle('active', a.getAttribute('href') === `#${entry.target.id}`));
  });
}, { rootMargin: '-35% 0px -55% 0px', threshold: 0 });
  observers.push(sectionObserver);
sections.forEach((section) => sectionObserver.observe(section));

// Portfolio spotlight modal
const modal = document.querySelector('#project-modal');
const modalTitle = document.querySelector('#modal-title');
const modalCategory = document.querySelector('#modal-category');
const modalBody = document.querySelector('#modal-body');
const modalLink = document.querySelector('#modal-link');
const modalClose = document.querySelector('#modal-close');
const projectData = {
  business: {
    title: 'Business Website', category: 'BUSINESS / INFORMATIONAL', body: 'A polished professional presence for businesses that need to explain what they do, build trust, and make it easy for customers to get in touch.', link: '#contact'
  },
  vera: {
    title: 'VERA', category: 'ECOMMERCE / FASHION', body: 'A premium fashion storefront concept with product discovery, variants, cart, checkout, accounts, orders, search, wishlist, journal content, and a polished mobile experience.', link: 'https://vera-ecommerce-demo.dammzml69420.workers.dev/'
  },
  novaire: {
    title: 'NOVAIRE', category: 'ECOMMERCE / LIFESTYLE', body: 'Our flagship ecommerce demonstration. It explores a premium content-led storefront alongside merchant tools for products, inventory, customers, discounts, reviews, invoices, tax settings, analytics, and content.', link: 'https://novaire-ecommerce-demo.dammzml69420.workers.dev/'
  },
  aavira: {
    title: 'AAVIRA', category: 'PREMIUM SHOWCASE', body: 'A refined premium showcase demonstrating how a brand can combine strong editorial presentation, product storytelling, and a polished responsive experience.', link: 'https://aavira-premium-showcase.lovable.app/'
  }
};
const openProject = (key) => {
  if (!modal || !projectData[key]) return;
  const data = projectData[key];
  modalTitle.textContent = data.title;
  modalCategory.textContent = data.category;
  modalBody.textContent = data.body;
  modalLink.href = data.link;
  modalLink.textContent = key === 'business' ? 'Start a conversation ↗' : 'Open live demo ↗';
  modalLink.target = key === 'business' ? '' : '_blank';
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
  body.classList.add('modal-open');
};
document.querySelectorAll('[data-project]').forEach((el) => on(el,'click', () => openProject(el.dataset.project)));
const closeProject = () => {
  modal?.classList.remove('open');
  modal?.setAttribute('aria-hidden', 'true');
  body.classList.remove('modal-open');
};
on(modalClose,'click', closeProject);
on(modal,'click', (e) => { if (e.target === modal) closeProject(); });
on(window,'keydown', (e) => { if (e.key === 'Escape') { closeProject(); closeMenu(); } });

// Inquiry form
const form = document.querySelector('#inquiry-form');
const success = document.querySelector('.form-success');
on(form,'submit', (event) => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(form).entries());
  const email = 'YOUR_EMAIL_HERE';
  if (email === 'YOUR_EMAIL_HERE') {
    success.classList.add('show');
    success.querySelector('strong').textContent = 'Your inquiry is ready.';
    success.querySelector('span').textContent = 'Add the studio email in script.js to enable email submission, then this form will open a pre-filled message.';
    return;
  }
  const subject = encodeURIComponent(`Website inquiry from ${data.name} / ${data.business}`);
  const bodyText = Object.entries(data).map(([key, value]) => `${key.toUpperCase()}: ${value}`).join('\n\n');
  window.location.href = `mailto:${email}?subject=${subject}&body=${encodeURIComponent(bodyText)}`;
  success.classList.add('show');
});

// Current year
const year = document.querySelector('[data-year]');
if (year) year.textContent = new Date().getFullYear();


// Service + pricing links pre-fill the inquiry form so every commercial CTA has a useful destination.
const inquiryForm = document.querySelector('#inquiry-form');
const packageSelect = inquiryForm?.querySelector('select[name="package"]');
const typeSelect = inquiryForm?.querySelector('select[name="type"]');
const focusInquiry = () => {
  document.querySelector('#contact')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  setTimeout(() => inquiryForm?.querySelector('input[name="name"]')?.focus(), 550);
};
document.querySelectorAll('[data-package]').forEach((link) => {
  on(link,'click', () => {
    const value = link.dataset.package;
    if (packageSelect) packageSelect.value = value;
  });
});
document.querySelectorAll('[data-site-type]').forEach((link) => {
  on(link,'click', () => {
    const value = link.dataset.siteType;
    if (typeSelect) typeSelect.value = value;
  });
});

// Keyboard-friendly external demo cards.
document.querySelectorAll('.project-visual[data-project]').forEach((el) => {
  on(el,'keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); el.click(); }
  });
});

// Keep the modal's external links fully configured.
const originalOpenProject = openProject;

// Premium pricing detail panels
const priceModal = document.querySelector('#price-modal');
const priceModalClose = document.querySelector('#price-modal-close');
const priceModalCloseLink = document.querySelector('#price-modal-close-link');
const priceModalDiscuss = document.querySelector('#price-modal-discuss');
const priceModalIndex = document.querySelector('#price-modal-index');
const priceModalTier = document.querySelector('#price-modal-tier');
const priceModalPrice = document.querySelector('#price-modal-price');
const priceModalFit = document.querySelector('#price-modal-fit');
const priceModalTitle = document.querySelector('#price-modal-title');
const priceModalBody = document.querySelector('#price-modal-body');
const priceModalList = document.querySelector('#price-modal-list');
const priceModalBest = document.querySelector('#price-modal-best');

const priceDetails = {
  '3000': {
    index: '01 / STARTER', tier: 'STARTER', price: '₹3,000', fit: 'FOR BUSINESSES GETTING ONLINE', title: 'Affordable start',
    body: 'A focused starting point for a business that needs a professional home on the web without unnecessary complexity.',
    items: ['Professional business presence', 'Essential pages and business information', 'Responsive mobile-friendly layout', 'Clear contact path for enquiries', 'Project discussion before development'],
    best: 'Local businesses, service providers, independent professionals, and businesses creating their first proper online presence.'
  },
  '5000': {
    index: '02 / ESSENTIAL', tier: 'BEST VALUE', price: '₹5,000', fit: 'FOR BUSINESSES THAT WANT MORE', title: 'Strong online presence',
    body: 'The sweet spot for businesses that want a more complete website with stronger presentation, structure, and storytelling.',
    items: ['Expanded page structure', 'Premium visual direction', 'Responsive mobile-first design', 'Stronger content and information hierarchy', 'Project-specific planning before development'],
    best: 'Businesses that already know what they want to say online and want the website to feel considerably more polished than a basic brochure site.'
  },
  '10000': {
    index: '03 / PREMIUM', tier: 'PREMIUM', price: '₹10,000', fit: 'FOR A MORE SERIOUS ONLINE PRESENCE', title: 'Premium business site',
    body: 'A substantial custom website for businesses ready for a distinctive, highly polished presence with more room for pages, content, and interaction.',
    items: ['Premium multi-page experience', 'Custom visual direction', 'Advanced content structure', 'Mobile-first refinement', 'More detailed interaction and presentation', 'Project planning around the business'],
    best: 'Established businesses, premium local brands, professional services, and companies that want their website to become a meaningful part of their brand.'
  },
  '20000': {
    index: '04 / SIGNATURE', tier: 'SIGNATURE', price: '₹20,000', fit: 'FOR BUSINESSES THAT WANT THE FULL TREATMENT', title: 'Ultra-professional',
    body: 'The flagship starting point for a highly custom website shaped around a business with ambitious requirements, richer content, and a more distinctive digital experience.',
    items: ['Highly custom experience', 'Advanced interactions and motion', 'Extensive page structure', 'Detailed project planning', 'Refined responsive experience', 'Custom functionality discussed around the project'],
    best: 'Businesses that want a statement website, have specific requirements, or need a more bespoke online experience than a standard package.'
  }
};

function closePriceModal() {
  priceModal?.classList.remove('open');
  priceModal?.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('modal-open');
}

function openPriceModal(key) {
  const d = priceDetails[key];
  if (!d || !priceModal) return;
  priceModalIndex.textContent = d.index;
  priceModalTier.textContent = d.tier;
  priceModalPrice.textContent = d.price;
  priceModalFit.textContent = d.fit;
  priceModalTitle.textContent = d.title;
  priceModalBody.textContent = d.body;
  priceModalBest.textContent = d.best;
  priceModalList.innerHTML = d.items.map(item => `<li>${item}</li>`).join('');
  priceModalDiscuss.dataset.package = d.price;
  priceModal.classList.add('open');
  priceModal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('modal-open');
}

document.querySelectorAll('[data-price-detail]').forEach((button) => {
  on(button,'click', () => openPriceModal(button.dataset.priceDetail));
});
on(priceModalClose,'click', closePriceModal);
on(priceModalCloseLink,'click', closePriceModal);
on(priceModal,'click', (e) => { if (e.target === priceModal) closePriceModal(); });
on(priceModalDiscuss,'click', () => {
  const value = priceModalDiscuss.dataset.package;
  if (packageSelect) packageSelect.value = value;
  closePriceModal();
  setTimeout(focusInquiry, 180);
});
on(window,'keydown', (e) => { if (e.key === 'Escape') closePriceModal(); });


// Accessible skip link and back-to-top control for long editorial pages.
if (!document.querySelector('.fds-skip-link')) {
  const skip = document.createElement('a');
  skip.className = 'fds-skip-link';
  skip.href = '#main-content';
  skip.textContent = 'Skip to content';
  document.body.prepend(skip);
  cleanups.push(() => skip.remove());
}
let mainContent = document.querySelector('main, #work, .hero');
if (mainContent && !mainContent.id) mainContent.id = 'main-content';
let backToTop = document.querySelector('.fds-back-to-top');
if (!backToTop) {
  backToTop = document.createElement('button');
  backToTop.type = 'button';
  backToTop.className = 'fds-back-to-top';
  backToTop.setAttribute('aria-label', 'Back to top');
  backToTop.title = 'Back to top';
  backToTop.textContent = '↑';
  document.body.append(backToTop);
  cleanups.push(() => backToTop?.remove());
}
const updateBackToTop = () => backToTop?.classList.toggle('is-visible', window.scrollY > 640);
on(window, 'scroll', updateBackToTop, { passive: true });
on(backToTop, 'click', () => window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }));
updateBackToTop();

}

window.addEventListener('fds:route-rendered', (event)=>{
  if(event.detail?.path==='/' || ['/pricing','/work','/process','/about','/faq','/contact'].includes(event.detail?.path)) initPublicEnhancements();
  else if(publicCleanup) publicCleanup();
});
if(window.__FDS_ACTIVE_ROUTE_VIEW__==='public') initPublicEnhancements();
