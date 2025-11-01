<script lang="ts">
	import { type HTMLAttributes } from "svelte/elements"

	type ButtonProps = HTMLAttributes<HTMLButtonElement>

	const { children, ...rest }: ButtonProps = $props()
</script>

<button {...rest}>
	{@render children?.()}
</button>

<style>
	button {
		--border-thickness: 1px;
		--corner-size: 0.15em;
		--color: #fff;
		--border-color: #bb012d;

		filter: drop-shadow(0 10rem 10rem black);

		top: 1rem;
		right: 1rem;
		font-family: system-ui, sans-serif;
		font-weight: bold;
		font-size: 1.25rem;
		cursor: pointer;
		border: none;
		display: grid;
		place-items: center;
		padding: calc(0.5em + var(--corner-size));
		color: var(--color);
		--inner-border-size: var(--corner-size);
		background: conic-gradient(
				from 90deg at var(--border-thickness) var(--border-thickness),
				#0000 90deg,
				var(--color) 0
			)
			var(--inner-border-size) var(--inner-border-size) /
			calc(100% - var(--border-thickness) - 2 * var(--inner-border-size))
			calc(100% - var(--border-thickness) - 2 * var(--inner-border-size));
		transition: 0.15s ease-in-out;
		outline: var(--border-thickness) solid #0000;
		outline-offset: 0.3em;
		background-color: black;
	}

	button:hover,
	button:focus-visible {
		--inner-border-size: 0px;
		outline-color: var(--color);
		outline-offset: 0.1em;
	}

	button:not(:disabled) {
		opacity: 0.6;
	}

	button:disabled {
		pointer-events: none;
		opacity: 0.3;
	}
</style>
