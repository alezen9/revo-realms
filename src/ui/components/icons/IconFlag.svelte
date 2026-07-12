<script lang="ts">
	let { size = "1em" }: { size?: string } = $props()
</script>

<svg
	viewBox="0 0 20 20"
	xmlns="http://www.w3.org/2000/svg"
	fill="none"
	stroke="currentColor"
	stroke-linecap="round"
	stroke-linejoin="round"
	stroke-width=".64"
	preserveAspectRatio="xMidYMid meet"
	width={size}
	height={size}
>
	<g transform="translate(2 2)">
		<path d="M3.2.5v15.2" />
		<path
			d="M3.2 1.4c2.1-1 4.2-1 6.3 0s4.2 1 6.3 0v7c-2.1 1-4.2 1-6.3 0s-4.2-1-6.3 0z"
		/>
	</g>
</svg>
