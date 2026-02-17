// 粒子背景 + 鼠标交互
(function () {
  const canvas = document.createElement("canvas");
  canvas.id = "particle-canvas";
  canvas.style.cssText = `
    position:fixed; top:0; left:0;
    width:100%; height:100%;
    pointer-events:none;
    z-index:0;
    opacity:0.5;
  `;
  document.body.prepend(canvas);

  const ctx = canvas.getContext("2d");
  let W, H, particles = [], mouse = { x: -9999, y: -9999 };
  const COUNT = 80, CONNECT_DIST = 140, MOUSE_DIST = 160;

  function resize() {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }

  function Particle() {
    this.x = Math.random() * W;
    this.y = Math.random() * H;
    this.vx = (Math.random() - 0.5) * 0.4;
    this.vy = (Math.random() - 0.5) * 0.4;
    this.r = Math.random() * 1.5 + 0.5;
  }

  Particle.prototype.update = function () {
    this.x += this.vx;
    this.y += this.vy;
    if (this.x < 0 || this.x > W) this.vx *= -1;
    if (this.y < 0 || this.y > H) this.vy *= -1;
  };

  function init() {
    particles = [];
    for (let i = 0; i < COUNT; i++) particles.push(new Particle());
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    particles.forEach(p => p.update());

    // 连线
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < CONNECT_DIST) {
          ctx.beginPath();
          ctx.strokeStyle = `rgba(0,229,255,${1 - dist / CONNECT_DIST})`;
          ctx.lineWidth = 0.4;
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.stroke();
        }
      }

      // 鼠标连线
      const mdx = particles[i].x - mouse.x;
      const mdy = particles[i].y - mouse.y;
      const mdist = Math.sqrt(mdx * mdx + mdy * mdy);
      if (mdist < MOUSE_DIST) {
        ctx.beginPath();
        ctx.strokeStyle = `rgba(0,229,255,${1 - mdist / MOUSE_DIST})`;
        ctx.lineWidth = 0.8;
        ctx.moveTo(particles[i].x, particles[i].y);
        ctx.lineTo(mouse.x, mouse.y);
        ctx.stroke();

        // 鼠标附近粒子发光
        ctx.beginPath();
        ctx.arc(particles[i].x, particles[i].y, particles[i].r + 1, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(0,229,255,0.8)";
        ctx.fill();
      }
    }

    // 画粒子
    particles.forEach(p => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(0,229,255,0.7)";
      ctx.fill();
    });

    requestAnimationFrame(draw);
  }

  window.addEventListener("mousemove", e => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
  });
  window.addEventListener("resize", () => { resize(); init(); });

  resize();
  init();
  draw();
})();


// 打字机效果
document.addEventListener("DOMContentLoaded", function () {
  const h1 = document.querySelector(".md-content h1");
  if (!h1) return;
  const text = h1.textContent;
  h1.textContent = "";
  h1.style.borderRight = "2px solid #00e5ff";
  let i = 0;
  function type() {
    if (i < text.length) {
      h1.textContent += text[i++];
      setTimeout(type, 80);
    } else {
      setTimeout(() => h1.style.borderRight = "none", 500);
    }
  }
  type();
});