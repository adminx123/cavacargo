// Shared hamburger menu injection
const menuHTML = `
<div class="menu" id="menuToggle">
    <div></div>
    <div></div>
    <div></div>
</div>
<div class="dropdown" id="dropdownMenu">
    <a href="/">Home</a>
    <a href="pages/shop.html">Shop</a>
    <a href="pages/landing.html">Affiliate</a>
    <a href="pages/demo.html">Demo</a>
    <a href="pages/success.html">Success</a>
    <a href="#" id="freightQuoteLink">Freight Quote</a>
    <a href="#" id="binRentalLink">Bin Rental</a>
    <a href="mailto:support@cavacargo.com">Contact</a>
</div>
`;

// Inject at the beginning of body
document.body.insertAdjacentHTML('afterbegin', menuHTML);

// Add event listeners
document.addEventListener('DOMContentLoaded', () => {
    const menuToggle = document.getElementById('menuToggle');
    const dropdownMenu = document.getElementById('dropdownMenu');

    menuToggle.addEventListener('click', () => {
        menuToggle.classList.toggle('active');
        dropdownMenu.style.display = dropdownMenu.style.display === 'block' ? 'none' : 'block';
    });

    document.addEventListener('click', (event) => {
        if (!menuToggle.contains(event.target) && !dropdownMenu.contains(event.target)) {
            dropdownMenu.style.display = 'none';
            menuToggle.classList.remove('active');
        }
    });
});