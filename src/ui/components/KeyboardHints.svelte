<div class="keys" aria-label="Keyboard shortcuts">
	<span class="key" title="Landmarks Wheel">L</span>
	<span class="key" title="Pause / Resume">P </span>
</div>

<style>
	.keys {
		position: fixed;
		left: 1rem;
		top: 1rem;
		display: flex;
		gap: 0.4rem;
		pointer-events: auto;
		user-select: none;
	}

	.keys .key {
		--text-mix: 65%;
		--bg-mix: 100%;
		--border-mix: 60%;
		display: grid;
		place-items: center;
		min-width: 1rem;
		height: 1rem;
		padding: 0 0.25em;
		border-radius: 0.25em;
		color: color-mix(in oklab, rgb(200, 200, 200) var(--text-mix), transparent);
		background: color-mix(
			in oklab,
			rgba(0, 0, 0, 0.5) var(--bg-mix),
			transparent
		);
		border: 1px solid
			color-mix(
				in oklab,
				rgb(200, 200, 200) var(--border-mix),
				rgba(0, 0, 0, 0.5)
			);
		font-size: 0.6em;
		backdrop-filter: blur(4px);
	}
</style>
