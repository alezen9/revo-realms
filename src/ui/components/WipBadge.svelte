<span class="wip-badge" aria-label="Work in Progress">Work in Progress</span>

<style>
	.wip-badge {
		position: fixed;
		top: 1rem;
		left: 50%;
		transform: translateX(-50%);
		pointer-events: none;
		user-select: none;
		z-index: 9999;

		font-size: 1rem;
		font-family: system-ui, sans-serif;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		color: rgba(255, 255, 255, 0.34);
	}

	.wip-badge::before {
		position: absolute;
		content: "";
		left: -2.5rem;
		top: 50%;
		transform: translate(0, -50%);
		height: 1px;
		width: 2rem;
		background-color: rgba(255, 255, 255, 0.34);
	}

	.wip-badge::after {
		position: absolute;
		content: "";
		right: -2.5rem;
		top: 50%;
		transform: translate(0, -50%);
		height: 1px;
		width: 2rem;
		background-color: rgba(255, 255, 255, 0.34);
	}
</style>
