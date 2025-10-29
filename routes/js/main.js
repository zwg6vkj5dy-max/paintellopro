// public/js/main.js
console.log('✅ main.js loaded successfully!');

document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded - Paintello Pro scripts initialized');
    
    // Wilaya number auto-update
    const wilayaSelect = document.getElementById('wilaya');
    if (wilayaSelect) {
        console.log('Wilaya selector found');
        wilayaSelect.addEventListener('change', function() {
            const selectedOption = this.options[this.selectedIndex];
            if (selectedOption.value) {
                const wilayaNumber = selectedOption.text.match(/\((\d+)\)/)[1];
                const wilayaNumberInput = document.getElementById('wilayaNumber');
                if (wilayaNumberInput) {
                    wilayaNumberInput.value = wilayaNumber;
                    console.log('Wilaya number updated to:', wilayaNumber);
                }
            }
        });
    }

    // Profile picture preview
    const profilePictureInput = document.getElementById('profilePicture');
    if (profilePictureInput) {
        profilePictureInput.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    const preview = document.querySelector('.avatar-preview');
                    if (preview) {
                        preview.innerHTML = `<img src="${e.target.result}" alt="Preview" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;">`;
                        console.log('Profile picture preview updated');
                    }
                };
                reader.readAsDataURL(file);
            }
        });
    }

    // Auto-dismiss alerts
    const alerts = document.querySelectorAll('.alert');
    alerts.forEach(alert => {
        setTimeout(() => {
            if (alert && alert.parentNode) {
                const bsAlert = new bootstrap.Alert(alert);
                bsAlert.close();
            }
        }, 5000);
    });

    // Form submission loading states
    const forms = document.querySelectorAll('form');
    forms.forEach(form => {
        form.addEventListener('submit', function(e) {
            const submitBtn = this.querySelector('button[type="submit"]');
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Processing...';
            }
        });
    });
});

// Utility functions
window.formatCurrency = function(amount) {
    return new Intl.NumberFormat('fr-DZ', {
        style: 'currency',
        currency: 'DZD'
    }).format(amount);
};
