<script lang="ts">
	let { size = "1em" }: { size?: string } = $props()
</script>

<svg
	viewBox="0 0 24 24"
	xmlns="http://www.w3.org/2000/svg"
	fill="none"
	stroke="currentColor"
	preserveAspectRatio="xMidYMid meet"
	width={size}
	height={size}
>
	<circle cx="12" cy="12" r="9" stroke-width=".96" />
	<g fill="currentColor" stroke="none">
		<path
			d="M0-1.8.41-.57 1.71-.56.67.22 1.06 1.46 0 .7-1.06 1.46-.67.22-1.71-.56-.41-.57Z"
			transform="translate(12 8.8) scale(1.15)"
		/>
		<path
			d="M0-1.8.41-.57 1.71-.56.67.22 1.06 1.46 0 .7-1.06 1.46-.67.22-1.71-.56-.41-.57Z"
			transform="translate(15.2 12) scale(.9)"
		/>
		<path
			d="M0-1.8.41-.57 1.71-.56.67.22 1.06 1.46 0 .7-1.06 1.46-.67.22-1.71-.56-.41-.57Z"
			transform="translate(12 15.2) scale(1)"
		/>
		<path
			d="M0-1.8.41-.57 1.71-.56.67.22 1.06 1.46 0 .7-1.06 1.46-.67.22-1.71-.56-.41-.57Z"
			transform="translate(8.8 12) scale(.85)"
		/>
	</g>
</svg>
