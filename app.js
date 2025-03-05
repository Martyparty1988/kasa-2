let EXCHANGE_RATE = 25.5;
let currentVilla = null;
let cart = [];
let selectedItem = null;
let currentQuantity = 1;
let isCartOpen = false;

// Inicializace aplikace
async function init() {
    selectVilla('oh-yeah');
    await fetchExchangeRate(); // Načtení aktuálního kurzu
    updateStats();
}

// Správa vil
function selectVilla(villa) {
    currentVilla = villa;
    document.querySelectorAll('.villa-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelector(`.${villa}`).classList.add('active');
    renderInventory();
}

function renderInventory(category = 'all') {
    const inventoryEl = document.getElementById('inventory');
    inventoryEl.innerHTML = '';
    
    const filteredItems = category === 'all' 
        ? inventory[currentVilla] 
        : inventory[currentVilla].filter(item => item.category === category);

    filteredItems.forEach(item => {
        const itemEl = document.createElement('div');
        itemEl.className = `item ${currentVilla}`;
        itemEl.innerHTML = `
            <div class="item-image">
                <img src="${item.image}" alt="${item.name}">
            </div>
            <div class="item-name">${item.name}</div>
            <div class="item-price">${item.customPrice ? 'Vlastní cena' : `${item.price} ${item.currency}`}</div>
        `;
        itemEl.onclick = () => handleItemClick(item);
        inventoryEl.appendChild(itemEl);
    });
}

function handleItemClick(item) {
    showQuantitySelector(item);
}

// Správa množství
function showQuantitySelector(item) {
    selectedItem = item;
    currentQuantity = 1;
    const selector = document.getElementById('quantitySelector');
    document.getElementById('selectedItemName').textContent = item.name;
    document.getElementById('selectedItemPrice').textContent = `${item.price} ${item.currency}`;
    document.getElementById('quantityDisplay').textContent = currentQuantity;
    selector.style.display = 'block';
}

function hideQuantitySelector() {
    document.getElementById('quantitySelector').style.display = 'none';
    selectedItem = null;
    currentQuantity = 1;
}

function adjustQuantity(delta) {
    currentQuantity = Math.max(1, currentQuantity + delta);
    document.getElementById('quantityDisplay').textContent = currentQuantity;
}

function confirmQuantity() {
    if (selectedItem.customPrice) {
        const price = prompt('Zadejte cenu za jednotku v EUR:');
        if (price === null || isNaN(price) || price <= 0) return;
        selectedItem.price = parseFloat(price);
    }
    
    const newItems = Array(currentQuantity).fill().map((_, i) => ({
        ...selectedItem,
        id: Date.now() + i,
        quantity: 1
    }));
    
    cart.push(...newItems);
    hideQuantitySelector();
    renderCart();
    updateStats();
}

// Správa košíku
function toggleCart() {
    const cartPanel = document.getElementById('cartPanel');
    isCartOpen = !isCartOpen;
    cartPanel.classList.toggle('active', isCartOpen);
}

function removeFromCart(key) {
    const groupedItems = cart.reduce((acc, item) => {
        const itemKey = `${item.name}-${item.price}-${item.currency}`;
        if (!acc[itemKey]) acc[itemKey] = { ...item, quantity: 1 };
        else acc[itemKey].quantity++;
        return acc;
    }, {});

    const item = groupedItems[key];
    if (item.quantity > 1) {
        item.quantity--;
        cart = cart.filter(i => !(i.name === item.name && i.price === item.price && i.currency === item.currency && item.quantity === 0));
    } else {
        cart = cart.filter(i => !(i.name === item.name && i.price === item.price && i.currency === item.currency));
    }
    renderCart();
    updateStats();
}

function clearCart() {
    cart = [];
    renderCart();
    updateStats();
}

function renderCart() {
    const cartEl = document.getElementById('cartItems');
    document.getElementById('cartCount').textContent = cart.reduce((sum, item) => sum + item.quantity, 0);
    cartEl.innerHTML = '';
    
    const groupedItems = cart.reduce((acc, item) => {
        const key = `${item.name}-${item.price}-${item.currency}`;
        if (!acc[key]) acc[key] = { ...item, quantity: 1 };
        else acc[key].quantity++;
        return acc;
    }, {});
    
    Object.entries(groupedItems).forEach(([key, item]) => {
        const itemEl = document.createElement('div');
        itemEl.className = 'cart-item';
        itemEl.innerHTML = `
            <div>
                <span class="cart-item-quantity">×${item.quantity}</span>
                ${item.name}
            </div>
            <div>
                ${(item.price * item.quantity).toFixed(2)} ${item.currency}
                <button class="cart-item-remove" onclick="removeFromCart('${key}')">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
        cartEl.appendChild(itemEl);
    });
}

// Správa měn a výpočtů
async function fetchExchangeRate() {
    try {
        const response = await fetch('https://api.cnb.cz/cnbapi/exrates/daily?lang=cs');
        const data = await response.json();
        EXCHANGE_RATE = data.rates.find(rate => rate.currency === 'EUR').rate || 25.5;
        updateStats();
    } catch (error) {
        console.error('Nepodařilo se načíst kurz:', error);
    }
}

function updateExchangeRate() {
    const rate = prompt('Zadejte aktuální kurz EUR/CZK:', EXCHANGE_RATE);
    if (rate && !isNaN(rate) && rate > 0) {
        EXCHANGE_RATE = parseFloat(rate);
        updateStats();
    }
}

function calculateTotal(currency) {
    let itemsTotal = 0;
    let cityTaxTotal = 0;
    const discount = document.getElementById('discount').checked;
    const guests = parseInt(document.getElementById('guests').value) || 0;
    const nights = parseInt(document.getElementById('nights').value) || 0;

    // City Tax výpočet (2 EUR za osobu na noc)
    const cityTax = guests * nights * 2;
    cityTaxTotal = currency === 'CZK' ? cityTax * EXCHANGE_RATE : cityTax;

    // Součet položek s ohledem na množství
    const groupedItems = cart.reduce((acc, item) => {
        const key = `${item.name}-${item.price}-${item.currency}`;
        if (!acc[key]) acc[key] = { ...item, quantity: 1 };
        else acc[key].quantity++;
        return acc;
    }, {});

    Object.values(groupedItems).forEach(item => {
        let itemValue = item.price * item.quantity;
        if (item.currency !== currency) {
            itemValue = item.currency === 'EUR' 
                ? itemValue * EXCHANGE_RATE 
                : itemValue / EXCHANGE_RATE;
        }
        itemsTotal += itemValue;
    });

    // Výpočet slevy pouze z položek (bez City Tax)
    const discountAmount = discount ? (itemsTotal * 0.1) : 0;
    const total = itemsTotal + cityTaxTotal;

    return { total, discountAmount, itemsTotal, cityTaxTotal };
}

function updateStats() {
    const currency = document.getElementById('currency').value;
    const { total, discountAmount } = calculateTotal(currency);
    document.getElementById('totalItems').textContent = cart.reduce((sum, item) => sum + item.quantity, 0);
    document.getElementById('totalAmount').textContent = `${(total - discountAmount).toFixed(2)} ${currency}`;
}

// Generování faktury
function generateInvoice() {
    const currency = document.getElementById('currency').value;
    const paymentMethod = document.getElementById('paymentMethod').value;
    const guests = parseInt(document.getElementById('guests').value);
    const nights = parseInt(document.getElementById('nights').value);
    const discount = document.getElementById('discount').checked;

    if (isNaN(guests) || isNaN(nights) || guests < 1 || nights < 1) {
        alert('Zadejte platný počet hostů a nocí');
        return;
    }

    const { total, discountAmount, itemsTotal, cityTaxTotal } = calculateTotal(currency);
    const paymentMethods = {
        cash: 'Hotově',
        card: 'Kartou',
        unpaid: 'Neplaceno'
    };

    const villaColors = {
        'oh-yeah': 'var(--oh-yeah-color)',
        'amazing-pool': 'var(--amazing-pool-color)',
        'little-castle': 'var(--little-castle-color)'
    };

    const groupedItems = cart.reduce((acc, item) => {
        const key = `${item.name}-${item.price}-${item.currency}`;
        if (!acc[key]) acc[key] = { ...item, quantity: 1 };
        else acc[key].quantity++;
        return acc;
    }, {});

    const modal = document.getElementById('invoiceModal');
    const content = document.getElementById('invoiceContent');
    
    content.innerHTML = `
        <div class="invoice-header" style="color: ${villaColors[currentVilla]}">
            <h2>${document.querySelector('.villa-btn.active').textContent}</h2>
            <p>${new Date().toLocaleDateString()}</p>
        </div>
        <div class="invoice-items">
            ${Object.values(groupedItems).map(item => `
                <div class="cart-item">
                    <span>${item.name} (×${item.quantity})</span>
                    <span>${(item.price * item.quantity).toFixed(2)} ${item.currency}</span>
                </div>
            `).join('')}
            <div class="cart-item subtotal">
                <span>Mezisoučet položek</span>
                <span>${itemsTotal.toFixed(2)} ${currency}</span>
            </div>
            ${discountAmount > 0 ? `
                <div class="cart-item discount">
                    <span>Sleva 10% (z položek)</span>
                    <span>-${discountAmount.toFixed(2)} ${currency}</span>
                </div>
            ` : ''}
            <div class="cart-item">
                <span>City Tax (${guests} hostů × ${nights} nocí)</span>
                <span>${cityTaxTotal.toFixed(2)} ${currency}</span>
            </div>
        </div>
        <div class="total">
            Celkem: ${(total - discountAmount).toFixed(2)} ${currency}
        </div>
        <div class="payment-method">
            Způsob platby: ${paymentMethods[paymentMethod]}
        </div>
    `;
    
    modal.style.display = 'flex';
    modal.onclick = (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    };
}

// Event Listeners
document.addEventListener('DOMContentLoaded', init);

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        if (document.getElementById('quantitySelector').style.display === 'block') {
            hideQuantitySelector();
        }
        if (document.getElementById('invoiceModal').style.display === 'flex') {
            document.getElementById('invoiceModal').style.display = 'none';
        }
        if (isCartOpen) {
            toggleCart();
        }
    }
});