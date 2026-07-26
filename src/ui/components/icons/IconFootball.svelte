<script lang="ts">
	let { size = "1em" }: { size?: string } = $props()
</script>

<svg
	viewBox="0 0 32 32"
	xmlns="http://www.w3.org/2000/svg"
	fill="none"
	stroke="currentColor"
	stroke-linecap="round"
	stroke-linejoin="round"
	stroke-width="1.1"
	width={size}
	height={size}
>
	<path
		d="M30 16a14 14 0 1 1-28 0 14 14 0 0 1 28 0ZM16 10.2l6.2 4-2.7 6.5h-7.1l-2.6-6.5 6.2-4Zm0 0V5.5m-3.2-2.2L16 5.5l3.5-2M9.8 14.2l-4-1.8-1.3-4.3m1.3 4.3-3.3 3.1m19.7-1.3 3.8-1.8 1.5-4.3M26 12.4l3.5 3.1M12.4 20.7l-2.8 3.5-4.4-.2m4.4.2 2 4.3m7.9-7.8 2.5 3.5 4.7-.2M22 24.2l-1.4 4.4"
	/>
</svg>
