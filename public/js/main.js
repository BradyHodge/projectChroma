/**
 * Main JavaScript for Color Palette Generator
 */

document.addEventListener('DOMContentLoaded', function() {
    // Handle color copying when clicking on a color block
    document.querySelectorAll('.color-block').forEach(block => {
        block.addEventListener('click', function() {
            const hexCode = this.getAttribute('data-hex');
            copyToClipboard(hexCode);
            
            // Show tooltip
            const tooltip = document.createElement('div');
            tooltip.className = 'tooltip';
            tooltip.textContent = 'Copied!';
            this.appendChild(tooltip);
            
            // Remove tooltip after a delay
            setTimeout(() => {
                tooltip.remove();
            }, 1500);
        });
    });
    
    // Handle upvote buttons
    document.querySelectorAll('.upvote-btn').forEach(btn => {
        btn.addEventListener('click', async function(e) {
            e.preventDefault();
            
            const paletteId = this.getAttribute('data-palette-id');
            const countEl = this.querySelector('.upvote-count');
            
            try {
                const response = await fetch(`/palettes/${paletteId}/upvote`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });
                
                const data = await response.json();
                
                if (data.success) {
                    const currentCount = parseInt(countEl.textContent);
                    
                    if (data.action === 'added') {
                        countEl.textContent = currentCount + 1;
                        this.classList.add('active');
                    } else {
                        countEl.textContent = currentCount - 1;
                        this.classList.remove('active');
                    }
                }
            } catch (error) {
                console.error('Error:', error);
            }
        });
    });
    
    // Initialize color picker if on create/edit palette page
    initColorPicker();
    
    // Initialize admin panel functionality
    initAdminPanel();
});

/**
 * Copy text to clipboard
 * @param {string} text - Text to copy
 */
function copyToClipboard(text) {
    // Create temporary input element
    const input = document.createElement('input');
    input.value = text;
    document.body.appendChild(input);
    
    // Select and copy
    input.select();
    document.execCommand('copy');
    
    // Remove temporary element
    document.body.removeChild(input);
}

/**
 * Initialize color picker functionality
 */
function initColorPicker() {
    const colorPicker = document.getElementById('color-picker');
    const addColorBtn = document.getElementById('add-color');
    const colorsList = document.getElementById('colors-list');
    const colorPreview = document.getElementById('color-preview');
    const colorInput = document.getElementById('color-input');
    const colorsInput = document.getElementById('colors');
    
    if (!colorPicker) return;
    
    // Update preview when color picker changes
    colorInput.addEventListener('input', function() {
        colorPreview.style.backgroundColor = this.value;
    });
    
    // Add color to palette
    addColorBtn.addEventListener('click', function() {
        const color = colorInput.value;
        addColorToList(color);
    });
    
    // Initialize with existing colors if editing
    if (colorsInput.value) {
        const colors = JSON.parse(colorsInput.value);
        colors.forEach(color => {
            addColorToList(color);
        });
    }
    
    // Add color to list and update hidden input
    function addColorToList(color) {
        // Check if we've reached the maximum number of colors (10)
        // if (colorsList.children.length >= 10) {
        //     alert('Maximum of 10 colors allowed per palette');
        //     return;
        // }
        
        // Create color item
        const colorItem = document.createElement('div');
        colorItem.className = 'color-item';
        colorItem.style.backgroundColor = color;
        colorItem.setAttribute('data-color', color);
        
        // Add remove button
        const removeBtn = document.createElement('span');
        removeBtn.className = 'color-remove';
        removeBtn.innerHTML = '&times;';
        removeBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            colorItem.remove();
            updateColorsInput();
        });
        
        colorItem.appendChild(removeBtn);
        colorsList.appendChild(colorItem);
        
        // Update hidden input with all colors
        updateColorsInput();
    }
    
    // Update hidden input with current colors
    function updateColorsInput() {
        const colors = [];
        document.querySelectorAll('.color-item').forEach(item => {
            colors.push(item.getAttribute('data-color'));
        });
        
        colorsInput.value = JSON.stringify(colors);
    }
    
    // Make colors sortable
    if (typeof Sortable !== 'undefined') {
        new Sortable(colorsList, {
            animation: 150,
            onEnd: function() {
                updateColorsInput();
            }
        });
    }
}

/**
 * Initialize admin panel functionality
 */
function initAdminPanel() {
    // Toggle user status (disable/enable)
    document.querySelectorAll('.toggle-user-status').forEach(btn => {
        btn.addEventListener('click', async function() {
            const userId = this.getAttribute('data-user-id');
            const statusCell = document.querySelector(`#user-status-${userId}`);
            
            try {
                const response = await fetch(`/admin/users/${userId}/toggle-status`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });
                
                const data = await response.json();
                
                if (data.success) {
                    if (data.newStatus) {
                        statusCell.textContent = 'Disabled';
                        statusCell.className = 'text-danger';
                        this.textContent = 'Enable';
                        this.className = 'btn btn-sm btn-success toggle-user-status';
                    } else {
                        statusCell.textContent = 'Active';
                        statusCell.className = 'text-success';
                        this.textContent = 'Disable';
                        this.className = 'btn btn-sm btn-warning toggle-user-status';
                    }
                } else {
                    alert(data.message || 'An error occurred');
                }
            } catch (error) {
                console.error('Error:', error);
                alert('An error occurred');
            }
        });
    });
    
    // Change user role
    document.querySelectorAll('.change-role-form').forEach(form => {
        form.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const userId = this.getAttribute('data-user-id');
            const roleSelect = this.querySelector('select');
            const roleId = roleSelect.value;
            const roleCell = document.querySelector(`#user-role-${userId}`);
            
            try {
                const response = await fetch(`/admin/users/${userId}/change-role`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ roleId })
                });
                
                const data = await response.json();
                
                if (data.success) {
                    roleCell.textContent = data.newRole;
                    alert('Role updated successfully');
                } else {
                    alert(data.message || 'An error occurred');
                }
            } catch (error) {
                console.error('Error:', error);
                alert('An error occurred');
            }
        });
    });
    
    // Delete user
    document.querySelectorAll('.delete-user-btn').forEach(btn => {
        btn.addEventListener('click', async function() {
            if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
                return;
            }
            
            const userId = this.getAttribute('data-user-id');
            const userRow = document.querySelector(`#user-row-${userId}`);
            
            try {
                const response = await fetch(`/admin/users/${userId}/delete`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });
                
                const data = await response.json();
                
                if (data.success) {
                    userRow.remove();
                    alert('User deleted successfully');
                } else {
                    alert(data.message || 'An error occurred');
                }
            } catch (error) {
                console.error('Error:', error);
                alert('An error occurred');
            }
        });
    });
    
    // Resolve contact message
    document.querySelectorAll('.resolve-message-btn').forEach(btn => {
        btn.addEventListener('click', async function() {
            const messageId = this.getAttribute('data-message-id');
            const messageRow = document.querySelector(`#message-row-${messageId}`);
            
            try {
                const response = await fetch(`/admin/messages/${messageId}/resolve`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });
                
                const data = await response.json();
                
                if (data.success) {
                    messageRow.classList.add('resolved');
                    this.disabled = true;
                    this.textContent = 'Resolved';
                    
                    // Update status cell
                    const statusCell = messageRow.querySelector('.message-status');
                    if (statusCell) {
                        statusCell.textContent = 'Resolved';
                        statusCell.className = 'message-status text-success';
                    }
                } else {
                    alert('An error occurred');
                }
            } catch (error) {
                console.error('Error:', error);
                alert('An error occurred');
            }
        });
    });
    
    // Delete palette
    document.querySelectorAll('.delete-palette-btn').forEach(btn => {
        btn.addEventListener('click', async function() {
            if (!confirm('Are you sure you want to delete this palette? This action cannot be undone.')) {
                return;
            }
            
            const paletteId = this.getAttribute('data-palette-id');
            const paletteRow = document.querySelector(`#palette-row-${paletteId}`);
            
            try {
                const response = await fetch(`/admin/palettes/${paletteId}/delete`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });
                
                const data = await response.json();
                
                if (data.success) {
                    paletteRow.remove();
                    alert('Palette deleted successfully');
                } else {
                    alert(data.message || 'An error occurred');
                }
            } catch (error) {
                console.error('Error:', error);
                alert('An error occurred');
            }
        });
    });
}

/**
 * Generate a random color
 * @returns {string} - Random hex color
 */
function generateRandomColor() {
    const letters = '0123456789ABCDEF';
    let color = '#';
    
    for (let i = 0; i < 6; i++) {
        color += letters[Math.floor(Math.random() * 16)];
    }
    
    return color;
}

/**
 * Generate a random palette based on color theory
 * @param {string} baseColor - Base color to build palette around
 * @param {string} scheme - Color scheme to use ('analogous', 'complementary', 'triadic', etc.)
 * @param {number} count - Number of colors to generate
 * @returns {Array} - Array of hex colors
 */
function generateColorPalette(baseColor = null, scheme = 'analogous', count = 5) {
    // If no base color provided, generate a random one
    if (!baseColor) {
        baseColor = generateRandomColor();
    }
    
    // Convert hex to HSL for easier manipulation
    let h, s, l;
    
    // Convert hex to rgb
    const r = parseInt(baseColor.substring(1, 3), 16) / 255;
    const g = parseInt(baseColor.substring(3, 5), 16) / 255;
    const b = parseInt(baseColor.substring(5, 7), 16) / 255;
    
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    
    // Calculate hue
    if (max === min) {
        h = 0;
    } else if (max === r) {
        h = 60 * ((g - b) / (max - min));
    } else if (max === g) {
        h = 60 * (2 + (b - r) / (max - min));
    } else {
        h = 60 * (4 + (r - g) / (max - min));
    }
    
    if (h < 0) h += 360;
    
    // Calculate lightness
    l = (max + min) / 2;
    
    // Calculate saturation
    if (max === min) {
        s = 0;
    } else if (l <= 0.5) {
        s = (max - min) / (max + min);
    } else {
        s = (max - min) / (2 - max - min);
    }
    
    // Convert to percentages
    s *= 100;
    l *= 100;
    
    // Generate palette based on scheme
    const palette = [baseColor];
    
    switch (scheme) {
        case 'analogous':
            // Colors adjacent on the color wheel
            for (let i = 1; i < count; i++) {
                const newHue = (h + (i * 30)) % 360;
                palette.push(hslToHex(newHue, s, l));
            }
            break;
            
        case 'complementary':
            // Colors opposite on the color wheel
            palette.push(hslToHex((h + 180) % 360, s, l));
            
            // Add variations if more colors needed
            if (count > 2) {
                for (let i = 2; i < count; i++) {
                    const isLight = i % 2 === 0;
                    const newL = isLight ? Math.min(l + 15, 100) : Math.max(l - 15, 0);
                    palette.push(hslToHex(h, s, newL));
                }
            }
            break;
            
        case 'triadic':
            // Three colors evenly spaced on the color wheel
            palette.push(hslToHex((h + 120) % 360, s, l));
            palette.push(hslToHex((h + 240) % 360, s, l));
            
            // Add variations if more colors needed
            if (count > 3) {
                for (let i = 3; i < count; i++) {
                    const isLight = i % 2 === 0;
                    const baseIndex = i % 3;
                    const baseH = baseIndex === 0 ? h : (baseIndex === 1 ? (h + 120) % 360 : (h + 240) % 360);
                    const newL = isLight ? Math.min(l + 15, 100) : Math.max(l - 15, 0);
                    palette.push(hslToHex(baseH, s, newL));
                }
            }
            break;
            
        case 'monochromatic':
            // Different shades of the same color
            for (let i = 1; i < count; i++) {
                const newL = l + (i * (100 - l) / count);
                palette.push(hslToHex(h, s, newL));
            }
            break;
            
        default:
            // Random palette
            for (let i = 1; i < count; i++) {
                palette.push(generateRandomColor());
            }
    }
    
    return palette;
}

/**
 * Convert HSL values to hex color
 * @param {number} h - Hue (0-360)
 * @param {number} s - Saturation (0-100)
 * @param {number} l - Lightness (0-100)
 * @returns {string} - Hex color code
 */
function hslToHex(h, s, l) {
    h /= 360;
    s /= 100;
    l /= 100;
    
    let r, g, b;
    
    if (s === 0) {
        r = g = b = l;
    } else {
        const hue2rgb = (p, q, t) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1/6) return p + (q - p) * 6 * t;
            if (t < 1/2) return q;
            if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
            return p;
        };
        
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        
        r = hue2rgb(p, q, h + 1/3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1/3);
    }
    
    const toHex = (x) => {
        const hex = Math.round(x * 255).toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    };
    
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}