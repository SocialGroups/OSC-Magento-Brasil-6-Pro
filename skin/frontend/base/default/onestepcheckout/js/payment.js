OnestepcheckoutPayment = Class.create();
OnestepcheckoutPayment.prototype = {
    initialize: function(config) {
        this.container = $$(config.containerSelector).first();
        this.wrapContainer = $$(config.wrapContainerSelector).first();
        this.switchMethodInputs = $$(config.switchMethodInputsSelector);
        this.cvvInput = $$(config.cvvInputSelector).first();
        this.methodAdditionalContainerIdPrefix = config.methodAdditionalContainerIdPrefix;
        this.savePaymentUrl = config.savePaymentUrl;
        this.storedData = {};

        this.cvv = {};
        this.cvv.tooltip = $$(config.cvv.tooltipSelector).first();
        this.cvv.closeEl = $$(config.cvv.closeElSelector).first();
        this.cvv.triggerEls = $$(config.cvv.triggerElsSelector);

        if (navigator.userAgent.indexOf("MSIE 8.0") == -1) {
            this.initMock();
            this.init();
            this.initObservers();
        } else {
            var me = this;
            Event.observe(window, 'load', function(e){
                me.initMock();
                me.init();
                me.initObservers();
            });
        }
    },

    initMock: function() {
        window.payment = {
            switchMethod: Prototype.emptyFunction
        };
    },

    init: function() {
        var me = this;
        this.switchMethodInputs.each(function(element) {
            var methodCode = element.value;
            var additionalInfoContainer = $(me.methodAdditionalContainerIdPrefix + methodCode);
            if (additionalInfoContainer) {
                additionalInfoContainer.setStyle({'overflow':'hidden','display':'none'})
            }
            if (element.checked) {
                me.showAdditionalInfo(methodCode);
                me.currentMethod = methodCode;
            } else {
                me.hideAdditionalInfo(methodCode);
            }
        });
    },

    initObservers: function() {
        var me = this;
        //CVV
        this.cvv.triggerEls.each(function(element){
            element.observe('click', me.onTooltipTriggerElClick.bind(me));
        });
        if(this.cvv.closeEl){
            this.cvv.closeEl.observe('click', me.onTooltipTriggerElClick.bind(me));
        }
        //CID Jump
        if (this.cvvInput){
            this.cvvInput.observe('keyup', function(){
                var ccTypeContainer = $(this.id.substr(0,this.id.indexOf('_cc_cid')) + '_cc_type');
                var ccCidContainer = $(this.id.substr(0,this.id.indexOf('_cc_cid')) + '_cc_cid');

                if (!ccTypeContainer) {
                    return true;
                }
                var ccType = ccTypeContainer.value;

                if (typeof Validation.creditCartTypes.get(ccType) == 'undefined') {
                    return false;
                }
                var re = Validation.creditCartTypes.get(ccType)[1];

                if(re.test(ccCidContainer.value)){
                    OSCForm.placeOrderButton.focus();
                }
            });
        }

        //method changed
        this.switchMethodInputs.each(function(element) {
            element.observe('click', function(e) {
                me.switchToMethod(element.value);
            });
            var block = me.methodAdditionalContainerIdPrefix + element.value;
            [block + '_before', block, block + '_after'].each(function(elementId){
                var element = $(elementId);
                if (!element) {
                    return;
                }
                Form.getElements(element).each(function(formElement){
                    var event = formElement.tagName.toUpperCase () == 'SELECT' ? 'change' : 'blur';
                    formElement.observe(event, function(e){
                    //formElement.observe('change', function(e){
                        me.savePayment();
                        Validation.reset(formElement);
                    });
                });
            });
        });

        //on block update
        var me = this;
        if (!this.wrapContainer.addActionBlocksToQueueAfterFn) {
            this.wrapContainer.addActionBlocksToQueueAfterFn = function() {
                me.storedData = {};
                Form.getElements(me.wrapContainer).each(function(element){
                    var elementId = element.getAttribute('id');
                    if (elementId) {
                        me.storedData[elementId] = element.getValue();
                    }
                });
            }
        }
        if (!this.wrapContainer.removeActionBlocksFromQueueAfterFn) {
            this.wrapContainer.removeActionBlocksFromQueueAfterFn = function() {
                Form.getElements(me.wrapContainer).each(function(element){
                    var elementId = element.getAttribute('id');
                    if (elementId in me.storedData) {
                        element.setValue(me.storedData[elementId]);
                    }
                });
                me.storedData = {};
            }
        }
    },

    onTooltipTriggerElClick: function(e) {
        if(this.cvv.tooltip) {
            this.cvv.tooltip.setStyle({
                top: (Event.pointerY(e) - 560)+'px'
            });
            this.cvv.tooltip.toggle();
        }
        e.stop();
    },

    switchToMethod: function(methodCode) {
        var prefix = this.methodAdditionalContainerIdPrefix;
        if (this.currentMethod !== methodCode) {

            if (this.currentMethod && $(prefix + this.currentMethod)) {
                this.hideAdditionalInfo(this.currentMethod);
                $(prefix + this.currentMethod).fire('payment-method:switched-off', {method_code : this.currentMethod});
            }
            if ($(prefix + methodCode)){
                this.showAdditionalInfo(methodCode);
                $(prefix + methodCode).fire('payment-method:switched', {method_code : methodCode});
            } else {
                //Event fix for payment methods without form like "Check / Money order"
                document.body.fire('payment-method:switched', {method_code : methodCode});
            }
            OSCPayment.currentMethod = this.currentMethod = methodCode;
            this.savePayment();
        }
    },

    showAdditionalInfo: function(methodCode) {
        var me = this;
        var block = this.methodAdditionalContainerIdPrefix + methodCode;
        [block + '_before', block, block + '_after'].each(function(el) {
            var element = $(el);
            if (element) {
                //apply show effect
                element.setStyle({'display': '', height: '0px'});
                var newHeight = OnestepcheckoutCore.getElementHeight(element);
                me._applyEffect(element, newHeight, 0.5, function(){
                    element.setStyle({'height': ''});
                });

                //enable elements
                element.select('input', 'select', 'textarea', 'button').each(function(field) {

                    //if (0 > field.name.indexOf('hash')) field.value = '';
                    field.disabled = false;
                });
            }
        });
    },

    hideAdditionalInfo: function(methodCode) {
        var me = this;
        var block = this.methodAdditionalContainerIdPrefix + methodCode;
        [block + '_before', block, block + '_after'].each(function(el) {
            var element = $(el);
            if (element) {
                //apply hide effect
                me._applyEffect(element, 0, 0.5, function(){
                    element.setStyle({'display': 'none'});
                });

                //disable elements
                element.select('input', 'select', 'textarea', 'button').each(function(field) {
                    field.disabled = true;
                });
            }
        });
    },

    forcesavePayment: function() {
        var block = this.methodAdditionalContainerIdPrefix + this.currentMethod;
        [block + '_before', block, block + '_after'].each(function(el) {
            var element = $(el);
            if (!element) {
                return;
            }
        });
        OnestepcheckoutCore.updater.startRequest(this.savePaymentUrl, {
            method: 'post',
            parameters: Form.serialize(this.container.id, true)
        });
    },

    savePayment: function() {
        var me = this;
        var isValid = true;
        var block = this.methodAdditionalContainerIdPrefix + this.currentMethod;
        [block + '_before', block, block + '_after'].each(function(el) {
            var element = $(el);
            if (!element) {
                return;
            }
            //validation
            Form.getElements(element).each(function(vElm){
                var cn = $w(vElm.className);
                isValid = isValid && cn.all(function(name) {
                    var v = Validation.get(name);
                    try {
                        if(Validation.isVisible(vElm) && !v.test($F(vElm), vElm)) {
                            return false;
                        } else {
                            return true;
                        }
                    } catch(e) {
                        return true;
                    }
                });
            })
        });
        if (!isValid) {
            return;
        }
        OnestepcheckoutCore.updater.startRequest(this.savePaymentUrl, {
            method: 'post',
            parameters: Form.serialize(this.container.id, true)
        });
    },

    _applyEffect: function(element, newHeight, duration, afterFinish) {
        if (element.effect) {
            element.effect.cancel();
        }
        var afterFinishFn = afterFinish || Prototype.emptyFunction;
        element.effect = new Effect.Morph(element, {
            style: {
                'height': newHeight + 'px'
            },
            duration: duration,
            afterFinish: function(){
                delete element.effect;
                afterFinishFn();
            }
        });
    }
};