function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const main_container = document.getElementById('main_container');
  const grid_container = document.getElementById('grid-container');

  sidebar.classList.toggle('open');
  main_container.classList.toggle('open');
}
