document.getElementById('menu').addEventListener('click', () => {
  const sidebar = document.getElementById('sidebar');
  const main = document.getElementById('content');

  sidebar.classList.toggle('open');
  main.classList.toggle('open');
});
