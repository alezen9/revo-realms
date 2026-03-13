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
	<path
		d="M12 3v18m6-18c-2 3-6 3-6 3S8 6 6 3a9.46 9.46 0 0 0-2 6 9.46 9.46 0 0 0 2 6c2-3 6-3 6-3s4 0 6 3a9.46 9.46 0 0 0 2-6 9.46 9.46 0 0 0-2-6Z"
		fill="none"
		stroke-linecap="round"
		stroke-linejoin="round"
		stroke-width=".96"
	/>
</svg>
