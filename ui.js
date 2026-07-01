/**
 * UI.JS - UTILITÁRIOS DE INTERFACE
 * ================================================
 */

const UIModule = (() => {
    return {
        showScreen(screenId) {
            document.querySelectorAll('.screen').forEach(s => {
                s.classList.remove('active');
            });

            const screen = document.getElementById(screenId);
            if (screen) {
                screen.classList.add('active');
            }
        },

        showSection(sectionId) {
            document.querySelectorAll('.view-section').forEach(s => {
                s.classList.remove('active');
            });

            const section = document.getElementById(sectionId);
            if (section) {
                section.classList.add('active');
            }
        },

        showMessage(message, type = 'info', duration = CONFIG.UI.MESSAGE_TIMEOUT) {
            const msgDiv = document.createElement('div');
            msgDiv.className = `message message--${type}`;
            msgDiv.textContent = message;
            msgDiv.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                padding: 15px 20px;
                border-radius: 8px;
                z-index: 10000;
                animation: slideIn 0.3s ease;
            `;

            document.body.appendChild(msgDiv);

            setTimeout(() => {
                msgDiv.style.animation = 'slideOut 0.3s ease';
                setTimeout(() => msgDiv.remove(), 300);
            }, duration);
        },

        showError(message) {
            this.showMessage(message || '❌ Erro', 'error');
        },

        showSuccess(message) {
            this.showMessage(message || '✅ Sucesso', 'success');
        },

        openModal(modalId) {
            const modal = document.getElementById(modalId);
            if (modal) {
                modal.classList.remove('hidden');
            }
        },

        closeModal(modalId) {
            const modal = document.getElementById(modalId);
            if (modal) {
                modal.classList.add('hidden');
            }
        },

        setFormValue(formId, fieldId, value) {
            const form = document.getElementById(formId);
            const field = form?.querySelector(`[name="${fieldId}"]`);
            if (field) {
                field.value = value;
            }
        },

        getFormData(formId) {
            const form = document.getElementById(formId);
            if (!form) return null;

            const formData = new FormData(form);
            return Object.fromEntries(formData);
        },

        clearForm(formId) {
            const form = document.getElementById(formId);
            if (form) {
                form.reset();
            }
        },

        setText(elementId, text) {
            const el = document.getElementById(elementId);
            if (el) {
                el.textContent = text;
            }
        },

        setHTML(elementId, html) {
            const el = document.getElementById(elementId);
            if (el) {
                el.innerHTML = html;
            }
        },

        addClass(elementId, className) {
            const el = document.getElementById(elementId);
            if (el) {
                el.classList.add(className);
            }
        },

        removeClass(elementId, className) {
            const el = document.getElementById(elementId);
            if (el) {
                el.classList.remove(className);
            }
        },

        showLoading(elementId) {
            const el = document.getElementById(elementId);
            if (el) {
                el.innerHTML = '<div class="spinner">⏳</div>';
            }
        },

        hideLoading(elementId) {
            const el = document.getElementById(elementId);
            if (el) {
                el.innerHTML = '';
            }
        }
    };
})();

console.log('✅ ui.js carregado');
