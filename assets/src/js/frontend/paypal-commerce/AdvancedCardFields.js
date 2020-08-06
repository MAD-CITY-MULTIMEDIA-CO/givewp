/* globals paypal, Give, givePayPalCommerce, Event */
import DonationForm from './DonationForm';
import PaymentMethod from './PaymentMethod';

class AdvancedCardFields extends PaymentMethod {
	constructor( form ) {
		super( form );

		this.hostedFieldContainerStyleProperties = [
			'background-color',
			'box-sizing',
			'box-shadow',
			'border',
			'border-radius',
			'margin',
		];

		this.hostedInputFieldStyleProperties = [
			'color',
			'direction',
			'font-size',
			'letter-spacing',
			'line-height',
			'padding',
		];

		this.hostedFocusedInputFieldStyleProperties = [ 'color', 'border' ];

		this.hostedInputFieldPlaceholderStyleProperties = [ 'color' ];

		this.styles = {
			container: {},
			input: {},
			'input:focus': {},
			'input:placeholder': {},
		};

		this.setStyles();
	}
	/**
	 * Return whether or not render credit card fields.
	 *
	 * @since 2.8.0
	 *
	 * @return {boolean} Return boolean value whether we can render card fields or not.
	 */
	canRenderFields() {
		return paypal.HostedFields.isEligible() === true;
	}

	/**
	 * Render payment method.
	 *
	 * @since 2.8.0
	 */
	async renderPaymentMethodOption() {
		if ( ! this.canRenderFields() ) {
			Array.from( this.form.getElementsByClassName( 'give-paypal-commerce-cc-field-wrap' ) ).forEach(
				el => {
					// Remove separator.
					if ( el.previousElementSibling.classList.contains( 'separator-with-text' ) ) {
						el.previousElementSibling.remove();
					}
					el.remove();
				}
			);
			return;
		}

		const createOrder = this.createOrderHandler.bind( this );
		const onSubmitHandlerForDonationForm = this.onSubmitHandlerForDonationForm.bind( this );
		const styles = await this.getComputedInputFieldForHostedField();
		const fields = this.getFields();

		const hostedCardFields = await paypal.HostedFields.render( { createOrder, styles, fields } );

		this.addInitialStyleToHostedFieldsContainer();
		this.applyStyleWhenEventTriggerOnHostedFields( hostedCardFields );
		this.jQueryForm.on( 'submit', { hostedCardFields }, onSubmitHandlerForDonationForm );
	}

	/**
	 * Create order event handler for smart buttons.
	 *
	 * @since 2.8.0
	 *
	 * @param {object} data PayPal button data.
	 * @param {object} actions PayPal button actions.
	 *
	 * @return {Promise<unknown>} Return PayPal order id.
	 */
	async createOrderHandler( data, actions ) { // eslint-disable-line
		// eslint-disable-next-line
		const response = await fetch( `${ Give.fn.getGlobalVar( 'ajaxurl' ) }?action=give_paypal_commerce_create_order`, {
			method: 'POST',
			body: DonationForm.getFormDataWithoutGiveActionField( this.form ),
		} );

		const responseJson = await response.json();

		return responseJson.data.id;
	}

	/**
	 * Get fields.
	 *
	 * @since 2.8.0
	 * @return {object} Return object of card input field container details.
	 */
	getFields() {
		return {
			number: {
				selector: `#${ this.form.querySelector( 'div[id^="give-card-number-field-"]' ).getAttribute( 'id' ) }`,
				placeholder: givePayPalCommerce.cardFieldPlaceholders.cardNumber,
			},
			cvv: {
				selector: `#${ this.form.querySelector( 'div[id^="give-card-cvc-field-"]' ).getAttribute( 'id' ) }`,
				placeholder: givePayPalCommerce.cardFieldPlaceholders.cardCvc,
			},
			expirationDate: {
				selector: `#${ this.form.querySelector( 'div[id^="give-card-expiration-field-"]' ).getAttribute( 'id' ) }`,
				placeholder: givePayPalCommerce.cardFieldPlaceholders.expirationDate,
			},
		};
	}

	/**
	 * Approve PayPal payment after successfully payment.
	 *
	 * @since 2.8.0
	 *
	 * @param {string} orderId Order id.
	 *
	 * @return {Promise<any>} Return request response.
	 */
	async approvePayment( orderId ) {
		// eslint-disable-next-line
		const response = await fetch( `${ this.ajaxurl }?action=give_paypal_commerce_approve_order&order=` + orderId, {
			method: 'POST',
			body: DonationForm.getFormDataWithoutGiveActionField( this.form ),
		} );

		return await response.json();
	}

	/**
	 * Return wether or not payment approved successfully.
	 *
	 * @since 2.8.0
	 *
	 * @return {Promise<boolean>} Return boolean whether Payment approved or not.
	 */
	async isPaymentApproved() {
		const result = await this.approvePayment();

		return true === result.success;
	}

	/**
	 * Get computed style for hosted card fields.
	 *
	 * List of style properties support by PayPal for advanced card fields: https://developer.paypal.com/docs/business/checkout/reference/style-guide/#style-the-card-payments-fields
	 *
	 * @since 2.8.0
	 *
	 * @return {object} Return object of style properties.
	 */
	getComputedInputFieldForHostedField() {
		return {
			input: this.styles.input,
			':focus': {
				color: this.styles[ 'input:focus' ].color,
			},
			':placeholder': {
				color: this.styles[ 'input:placeholder' ].color,
			},
		};
	}

	/**
	 *
	 * Handle donation form submit event.
	 *
	 * @since 2.8.0
	 *
	 * @param {object} event jQuery event object.
	 *
	 * @return {boolean} Return boolean false value to stop form submission.
	 */
	async onSubmitHandlerForDonationForm( event ) {
		if ( ! DonationForm.isPayPalCommerceSelected( this.jQueryForm ) ) {
			return true;
		}

		event.preventDefault();

		const self = this;
		const data = event.data;
		const getExtraCardDetails = this.getExtraCardDetails.bind( this );

		const payload = await data.hostedCardFields.submit( getExtraCardDetails ).catch( error => {
			const errorStringByGroup = {};
			const errors = [];

			error.details.forEach( detail => {
				if ( ! errorStringByGroup.hasOwnProperty( `${ detail.field }` ) ) {
					// setup error label.
					let label = '';

					if ( -1 !== detail.field.indexOf( 'expiry' ) ) {
						label = givePayPalCommerce.paypalCardInfoErrorPrefixes.expirationDateField;
					} else if ( -1 !== detail.field.indexOf( 'number' ) ) {
						label = givePayPalCommerce.paypalCardInfoErrorPrefixes.cardNumberField;
					} else if ( -1 !== detail.field.indexOf( 'security_code' ) ) {
						label = givePayPalCommerce.paypalCardInfoErrorPrefixes.cardCvcField;
					}

					if ( label ) {
						errorStringByGroup[ `${ detail.field }` ] = [ `<strong>${ label }</strong>` ];
					} else {
						errorStringByGroup[ `${ detail.field }` ] = [];
					}
				}

				errorStringByGroup[ `${ detail.field }` ].push( `${ detail.description }.` );
			} );

			for ( const field in errorStringByGroup ) {
				errors.push( {
					message: errorStringByGroup[ field ].join( ' ' ),
				} );
			}

			Give.form.fn.addErrorsAndResetDonationButton(
				self.jQueryForm,
				Give.form.fn.getErrorHTML( errors )
			);
		} );

		// Approve payment on if we did not get any error.
		if ( payload ) {
			await this.onApproveHandler( payload );
		}

		return false;
	}

	/**
	 * Handle PayPal payment on approve event.
	 *
	 * @since 2.8.0
	 *
	 * @param {object} payload PayPal response object after payment completion.
	 */
	async onApproveHandler( payload ) {
		Give.form.fn.showProcessingState();

		const result = await this.approvePayment( payload.orderId );

		if ( ! result.success ) {
			Give.form.fn.hideProcessingState();

			if ( null === result.data.error ) {
				Give.form.fn.addErrorsAndResetDonationButton(
					this.jQueryForm,
					Give.form.fn.getErrorHTML( [ { message: givePayPalCommerce.defaultDonationCreationError } ] )
				);

				return;
			}

			const errorDetail = result.data.error.details[ 0 ];
			Give.form.fn.addErrorsAndResetDonationButton(
				this.jQueryForm,
				Give.form.fn.getErrorHTML( [ { message: errorDetail.description } ] )
			);

			return;
		}

		await DonationForm.attachOrderIdToForm( this.form, result.data.order.id );

		this.jQueryForm.off( 'submit' );
		this.jQueryForm.submit();
	}

	/**
	 * Get extra card detail form like card name etc.
	 *
	 * In future we can add billing field: https://developer.paypal.com/docs/business/checkout/advanced-card-payments/
	 *
	 * @since 2.8.0
	 *
	 * @return {{cardholderName: *}} Card details object.
	 */
	getExtraCardDetails() {
		return {
			cardholderName: this.form.getElementById( '#card_name' ).value,
		};
	}

	/**
	 * Add style to hosted field's container.
	 *
	 * @since 2.8.0
	 */
	addInitialStyleToHostedFieldsContainer() {
		const fields = this.getFields();

		// Apply styles
		for ( const fieldKey in fields ) {
			const target = document.getElementById( fields[ fieldKey ].selector.replace( '#', '' ) );

			this.hostedFieldContainerStyleProperties.forEach( property => {
				target.style.setProperty( property, this.styles.container[ property ] );
			} );
		}
	}

	/**
	 * Add initial style to hosted card field container.
	 *
	 * @since 2.8.0
	 *
	 * @param {object} hostedCardFields Hosted card field object
	 */
	applyStyleWhenEventTriggerOnHostedFields( hostedCardFields ) {
		const self = this;

		hostedCardFields.on( 'focus', function( event ) {
			const target = document.querySelector( self.getFields()[ event.emittedBy ].selector );
			target.style.border = self.styles[ 'input:focus' ].border;
		} );

		hostedCardFields.on( 'blur', function( event ) {
			const target = document.querySelector( self.getFields()[ event.emittedBy ].selector );
			target.style.border = self.styles.container.border;
		} );
	}

	/**
	 * Set style properties for hosted card field and its container.
	 *
	 * @since 2.8.0
	 */
	setStyles() {
		const self = this;
		const sources = this.form.querySelectorAll( 'input[type="text"]' );
		sources.forEach( source => {
			// Get style properties for focused input field.
			source.addEventListener( 'focus', event => {
				if ( Array.from( self.styles[ 'input:focus' ] ).length ) {
					return;
				}

				const computedStyle = window.getComputedStyle( event.target, null );

				self.hostedFocusedInputFieldStyleProperties.forEach( property => {
					self.styles[ 'input:focus' ] = {
						[ property ]: computedStyle.getPropertyValue( property ),
						...	self.styles[ 'input:focus' ],
					};
				} );
			}, { once: true } );

			source.addEventListener( 'blur', event => {
				if ( Array.from( self.styles.container ).length ) {
					return;
				}

				const computedStyle = window.getComputedStyle( event.target, null );

				self.hostedFieldContainerStyleProperties.forEach( property => {
					self.styles.container = {
						[ property ]: computedStyle.getPropertyValue( property ),
						...	self.styles.container,
					};
				} );

				self.hostedInputFieldStyleProperties.forEach( property => {
					self.styles.input = {
						[ property ]: computedStyle.getPropertyValue( property ),
						...	self.styles.input,
					};
				} );

				self.hostedInputFieldPlaceholderStyleProperties.forEach( property => {
					self.styles[ 'input:placeholder' ] = {
						[ property ]: computedStyle.getPropertyValue( property ),
						...	self.styles[ 'input:placeholder' ],
					};
				} );
			}, { once: true } );
		} );

		// Set style properties for container input field and input, placeholder.
		const event = new Event( 'blur' );
		this.form.querySelector( 'input[name="card_name"]' ).dispatchEvent( event );
	}
}

export default AdvancedCardFields;
