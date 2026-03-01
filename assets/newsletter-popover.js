import { Component } from "@theme/component";

/**
 * Newsletter Popover Component
 *
 * Features:
 * - Shows popover after configurable delay
 * - Minimizes to floating button when closed
 * - X button on minimized button to permanently close
 * - Subscribed users: permanently hidden after close
 * - Non-subscribed users: 3-day hide cycle
 */
class NewsletterPopover extends Component {
	constructor() {
		super();

		this.state = {
			isVisible: false,
			isMinimized: false,
			isLoading: false,
			hasSubmitted: false,
			currentView: "form",
		};

		this.config = {
			storageKey: "newsletter_subscriptions",
			dismissedKey: "newsletter_popover_dismissed",
			closedForeverKey: "newsletter_popover_closed_forever",
			subscribedKey: "newsletter_subscribed",
			emailRegex: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
			hideDuration: 3 * 24 * 60 * 60 * 1000, // 3 days in milliseconds
			animationDuration: 300,
		};

		this.refs = {
			overlay: null,
			form: null,
			input: null,
			submitBtn: null,
			errorMessage: null,
			closeBtn: null,
			minimizedWrapper: null,
			minimizedBtn: null,
			minimizedCloseBtn: null,
			formState: null,
			successState: null,
			errorState: null,
			retryBtn: null,
			dismissBtn: null,
		};
	}

	connectedCallback() {
		super.connectedCallback();

		this.initializeConfig();

		if (!this.shouldShowPopover()) {
			this.hide();
			return;
		}

		this.cacheElements();
		this.bindEvents();
		this.scheduleShow();
	}

	initializeConfig() {
		this.config.enabled = this.dataset.enabled === "true";
		this.config.delay = parseInt(this.dataset.delay, 10) || 5;
		this.config.position = this.dataset.position || "center";
		this.config.preventDuplicates = this.dataset.preventDuplicates === "true";
		this.config.showMinimized = this.dataset.showMinimized === "true";
	}

	/**
	 * Check if popover should be shown
	 */
	shouldShowPopover() {
		if (!this.config.enabled) {
			console.log("[NewsletterPopover] Disabled in settings");
			return false;
		}

		// Check if permanently closed (X button clicked)
		if (this.isPermanentlyClosed()) {
			console.log("[NewsletterPopover] Permanently closed by user");
			return false;
		}

		// Check if user is subscribed
		if (this.isUserSubscribed()) {
			console.log("[NewsletterPopover] User is subscribed");
			return false;
		}

		return true;
	}

	/**
	 * Check if popover was permanently closed (X button on minimized)
	 */
	isPermanentlyClosed() {
		try {
			const closedForever = localStorage.getItem(this.config.closedForeverKey);
			return closedForever === "true";
		} catch (error) {
			console.error("[NewsletterPopover] Error checking closed forever:", error);
			return false;
		}
	}

	/**
	 * Check if user has subscribed
	 */
	isUserSubscribed() {
		try {
			const subscribed = localStorage.getItem(this.config.subscribedKey);
			return subscribed === "true";
		} catch (error) {
			console.error("[NewsletterPopover] Error checking subscription:", error);
			return false;
		}
	}

	/**
	 * Check if should show minimized button
	 * @param {boolean} isClosing - Whether we're checking during close action
	 */
	shouldShowMinimized(isClosing = false) {
		// Don't show if permanently closed
		if (this.isPermanentlyClosed()) {
			return false;
		}

		// Don't show if subscribed
		if (this.isUserSubscribed()) {
			return false;
		}

		// When closing, always show minimized (3-day cycle applies to next page load)
		if (isClosing) {
			return true;
		}

		// Check if recently dismissed (3-day cycle for non-subscribed users)
		const dismissed = localStorage.getItem(this.config.dismissedKey);
		if (dismissed) {
			const dismissedTime = parseInt(dismissed, 10);
			const now = Date.now();

			if (now - dismissedTime < this.config.hideDuration) {
				console.log("[NewsletterPopover] Within 3-day hide period");
				return false;
			}
		}

		return true;
	}

	cacheElements() {
		this.refs.overlay = this.querySelector(".newsletter-popover__overlay");
		this.refs.form = this.querySelector(".newsletter-popover__form");
		this.refs.input = this.querySelector(".newsletter-popover__input");
		this.refs.submitBtn = this.querySelector(".newsletter-popover__submit");
		this.refs.errorMessage = this.querySelector(".newsletter-popover__error");
		this.refs.closeBtn = this.querySelector(".newsletter-popover__close");
		this.refs.minimizedWrapper = this.querySelector(".newsletter-popover__minimized-wrapper");
		this.refs.minimizedBtn = this.querySelector(".newsletter-popover__minimized");
		this.refs.minimizedCloseBtn = this.querySelector(".newsletter-popover__minimized-close");
		this.refs.formState = this.querySelector(".newsletter-popover__form-state");
		this.refs.successState = this.querySelector(".newsletter-popover__success-state");
		this.refs.errorState = this.querySelector(".newsletter-popover__error-state");
		this.refs.retryBtn = this.querySelector(".newsletter-popover__retry");
		this.refs.dismissBtn = this.querySelector(".newsletter-popover__dismiss");
	}

	bindEvents() {
		if (this.refs.form) {
			this.refs.form.addEventListener("submit", this.handleSubmit.bind(this));
		}

		if (this.refs.input) {
			this.refs.input.addEventListener("blur", this.handleInputBlur.bind(this));
			this.refs.input.addEventListener("input", this.handleInputChange.bind(this));
			this.refs.input.addEventListener("keydown", this.handleInputKeydown.bind(this));
		}

		if (this.refs.closeBtn) {
			this.refs.closeBtn.addEventListener("click", this.handleMinimize.bind(this));
		}

		if (this.refs.overlay) {
			this.refs.overlay.addEventListener("click", this.handleMinimize.bind(this));
		}

		if (this.refs.minimizedBtn) {
			this.refs.minimizedBtn.addEventListener("click", this.handleRestore.bind(this));
		}

		// X button on minimized - permanently close
		if (this.refs.minimizedCloseBtn) {
			this.refs.minimizedCloseBtn.addEventListener("click", this.handlePermanentClose.bind(this));
		}

		if (this.refs.retryBtn) {
			this.refs.retryBtn.addEventListener("click", this.handleRetry.bind(this));
		}

		if (this.refs.dismissBtn) {
			this.refs.dismissBtn.addEventListener("click", this.handleMinimize.bind(this));
		}

		document.addEventListener("keydown", this.handleKeydown.bind(this));
		document.addEventListener("visibilitychange", this.handleVisibilityChange.bind(this));
	}

	scheduleShow() {
		if (this.config.delay === 0) {
			this.show();
			return;
		}

		this.showTimeout = setTimeout(() => {
			this.show();
		}, this.config.delay * 1000);
	}

	show() {
		if (this.state.isVisible || this.state.isMinimized) return;

		this.state.isVisible = true;
		this.classList.add("is-visible");

		// Hide minimized wrapper when showing popover
		if (this.refs.minimizedWrapper) {
			this.refs.minimizedWrapper.hidden = true;
			this.refs.minimizedWrapper.classList.remove("is-visible");
		}

		if (this.refs.input) {
			setTimeout(() => {
				this.refs.input.focus();
			}, this.config.animationDuration);
		}

		this.announce("Newsletter subscription form is now open");
		console.log("[NewsletterPopover] Shown");
	}

	hide() {
		console.log("[NewsletterPopover] hide() called - this will hide minimized button too");

		this.state.isVisible = false;
		this.state.isMinimized = false;
		this.classList.remove("is-visible", "is-minimized");

		if (this.refs.minimizedWrapper) {
			this.refs.minimizedWrapper.hidden = true;
			this.refs.minimizedWrapper.classList.remove("is-visible");
		}

		if (this.showTimeout) {
			clearTimeout(this.showTimeout);
		}

		console.log("[NewsletterPopover] Hidden");
	}

	minimize() {
		console.log("[NewsletterPopover] minimize() called");

		this.state.isVisible = false;
		this.state.isMinimized = true;
		this.classList.remove("is-visible");

		// Check if we should show minimized button (pass true for isClosing)
		const shouldShow = this.shouldShowMinimized(true);
		console.log("[NewsletterPopover] shouldShowMinimized:", shouldShow);

		// Store dismissal time for 3-day cycle
		try {
			localStorage.setItem(this.config.dismissedKey, Date.now().toString());
		} catch (error) {
			console.error("[NewsletterPopover] Error storing dismissal:", error);
		}

		// Show minimized button
		if (this.refs.minimizedWrapper && shouldShow) {
			console.log("[NewsletterPopover] Showing minimized wrapper");

			// Remove hidden attribute first
			this.refs.minimizedWrapper.hidden = false;
			console.log("[NewsletterPopover] hidden attribute removed");

			// Small delay to ensure DOM update
			setTimeout(() => {
				if (this.refs.minimizedWrapper) {
					this.refs.minimizedWrapper.classList.add("is-visible");
					console.log(
						"[NewsletterPopover] Added is-visible class, classes:",
						this.refs.minimizedWrapper.className,
					);
				}
			}, 50);
		} else {
			console.log("[NewsletterPopover] Not showing minimized wrapper:", {
				hasWrapper: !!this.refs.minimizedWrapper,
				shouldShow: shouldShow,
			});
		}
	}

	restore() {
		this.state.isMinimized = false;
		this.state.isVisible = true;
		this.classList.add("is-visible");

		if (this.refs.minimizedWrapper) {
			this.refs.minimizedWrapper.hidden = true;
			this.refs.minimizedWrapper.classList.remove("is-visible");
		}

		if (this.refs.input && this.state.currentView === "form") {
			this.refs.input.focus();
		}

		console.log("[NewsletterPopover] Restored");
	}

	/**
	 * Permanently close (X button on minimized)
	 */
	handlePermanentClose(event) {
		event.stopPropagation();

		try {
			localStorage.setItem(this.config.closedForeverKey, "true");
		} catch (error) {
			console.error("[NewsletterPopover] Error setting closed forever:", error);
		}

		// Hide minimized wrapper
		if (this.refs.minimizedWrapper) {
			this.refs.minimizedWrapper.hidden = true;
			this.refs.minimizedWrapper.classList.remove("is-visible");
		}

		this.announce("Newsletter closed permanently");
		console.log("[NewsletterPopover] Permanently closed");
	}

	async handleSubmit(event) {
		event.preventDefault();

		if (this.state.isLoading) return;

		const email = this.refs.input?.value.trim();

		if (!this.validateEmail(email)) {
			this.showValidationError("Please enter a valid email address");
			return;
		}

		if (this.config.preventDuplicates && this.isEmailSubscribed(email)) {
			this.showValidationError("This email is already subscribed");
			return;
		}

		this.setLoading(true);

		try {
			await this.submitSubscription(email);
			this.handleSuccess(email);
		} catch (error) {
			console.error("[NewsletterPopover] Submission error:", error);
			this.handleError(error);
		} finally {
			this.setLoading(false);
		}
	}

	submitSubscription(email) {
		const formData = new FormData(this.refs.form);

		return fetch("/contact", {
			method: "POST",
			body: formData,
			headers: {
				Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
			},
		}).then((response) => {
			if (response.ok || response.status === 302 || response.redirected) {
				return response;
			}
			throw new Error(`HTTP ${response.status}: ${response.statusText}`);
		});
	}

	handleSuccess(email) {
		this.state.hasSubmitted = true;
		this.state.currentView = "success";

		// Mark user as subscribed
		try {
			localStorage.setItem(this.config.subscribedKey, "true");
			localStorage.setItem(this.config.closedForeverKey, "true");
		} catch (error) {
			console.error("[NewsletterPopover] Error storing subscription status:", error);
		}

		this.storeSubscription(email);
		this.switchView("success");
		this.announce("Successfully subscribed to newsletter");

		console.log("[NewsletterPopover] Subscription successful");
	}

	handleError(error) {
		this.state.currentView = "error";
		this.switchView("error");
		this.announce("Subscription failed. Please try again.");
		console.error("[NewsletterPopover] Subscription failed:", error);
	}

	switchView(view) {
		if (this.refs.formState) {
			this.refs.formState.hidden = view !== "form";
		}
		if (this.refs.successState) {
			this.refs.successState.hidden = view !== "success";
		}
		if (this.refs.errorState) {
			this.refs.errorState.hidden = view !== "error";
		}

		this.state.currentView = view;
	}

	handleRetry() {
		this.switchView("form");

		if (this.refs.input) {
			this.refs.input.value = "";
			this.refs.input.classList.remove("is-invalid");
			this.refs.input.focus();
		}

		if (this.refs.errorMessage) {
			this.refs.errorMessage.textContent = "";
		}
	}

	validateEmail(email) {
		return this.config.emailRegex.test(email);
	}

	isEmailSubscribed(email) {
		try {
			const subscriptions = JSON.parse(localStorage.getItem(this.config.storageKey) || "[]");
			return subscriptions.some((sub) => sub.email.toLowerCase() === email.toLowerCase());
		} catch (error) {
			console.error("[NewsletterPopover] Error checking email:", error);
			return false;
		}
	}

	storeSubscription(email) {
		try {
			const subscriptions = JSON.parse(localStorage.getItem(this.config.storageKey) || "[]");
			subscriptions.push({
				email: email,
				date: new Date().toISOString(),
			});
			localStorage.setItem(this.config.storageKey, JSON.stringify(subscriptions));
		} catch (error) {
			console.error("[NewsletterPopover] Error storing subscription:", error);
		}
	}

	showValidationError(message) {
		if (this.refs.input) {
			this.refs.input.classList.add("is-invalid");
			this.refs.input.setAttribute("aria-invalid", "true");
		}

		if (this.refs.errorMessage) {
			this.refs.errorMessage.textContent = message;
		}

		this.announce(message, "assertive");
	}

	clearValidationError() {
		if (this.refs.input) {
			this.refs.input.classList.remove("is-invalid");
			this.refs.input.setAttribute("aria-invalid", "false");
		}

		if (this.refs.errorMessage) {
			this.refs.errorMessage.textContent = "";
		}
	}

	setLoading(isLoading) {
		this.state.isLoading = isLoading;

		if (this.refs.submitBtn) {
			this.refs.submitBtn.disabled = isLoading;
			this.refs.submitBtn.classList.toggle("is-loading", isLoading);
			this.refs.submitBtn.setAttribute("aria-busy", isLoading.toString());
		}

		if (this.refs.input) {
			this.refs.input.disabled = isLoading;
		}
	}

	handleInputBlur() {
		const email = this.refs.input?.value.trim();

		if (email && !this.validateEmail(email)) {
			this.showValidationError("Please enter a valid email address");
		}
	}

	handleInputChange() {
		this.clearValidationError();
	}

	handleInputKeydown(event) {
		if (event.key === "Enter") {
			event.preventDefault();
			this.refs.form?.dispatchEvent(new Event("submit"));
		}
	}

	handleMinimize() {
		this.minimize();
	}

	handleRestore() {
		this.restore();
	}

	handleKeydown(event) {
		if (event.key === "Escape" && this.state.isVisible) {
			this.handleMinimize();
		}
	}

	handleVisibilityChange() {
		if (document.hidden && this.showTimeout) {
			clearTimeout(this.showTimeout);
		} else if (
			!document.hidden &&
			!this.state.isVisible &&
			!this.state.isMinimized &&
			!this.state.hasSubmitted
		) {
			this.scheduleShow();
		}
	}

	announce(message, priority = "polite") {
		const announcement = document.createElement("div");
		announcement.setAttribute("role", "status");
		announcement.setAttribute("aria-live", priority);
		announcement.setAttribute("aria-atomic", "true");
		announcement.className = "visually-hidden";
		announcement.textContent = message;

		document.body.appendChild(announcement);

		setTimeout(() => {
			document.body.removeChild(announcement);
		}, 1000);
	}

	disconnectedCallback() {
		super.disconnectedCallback();

		if (this.showTimeout) {
			clearTimeout(this.showTimeout);
		}

		document.removeEventListener("keydown", this.handleKeydown);
		document.removeEventListener("visibilitychange", this.handleVisibilityChange);
	}
}

if (!customElements.get("newsletter-popover")) {
	customElements.define("newsletter-popover", NewsletterPopover);
}

export { NewsletterPopover };
