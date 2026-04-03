<script lang="ts">
	import type { HTMLDialogAttributes } from "svelte/elements"

	const { isShown, ...rest }: { isShown: boolean } & HTMLDialogAttributes =
		$props()
	let el: HTMLDialogElement

	$effect(() => {
		if (isShown) el.showModal()
		else el.close()
	})
</script>

<dialog {...rest} bind:this={el}>
	<div class="credits-content">
		<h1>Acknowledgements</h1>
		<p class="credits-status">
			This list is currently being refreshed, so it may be slightly out of date,
			sorry about that. Some credits may still reference resources no longer
			used in the project, and a few active ones may still be missing for now.
		</p>

		<div class="gratitude">
			<p>
				I'd like to express my sincere gratitude to all the artists and
				platforms whose work made this project possible. Whether by filling the
				gaps in my own skillset or helping me save precious development time,
				these assets played a key role in shaping this imaginary world.
			</p>
			<p>
				In most cases, I adapted the original works — by trimming, simplifying,
				or repurposing them — but I remain deeply thankful to each creator for
				sharing their work.
			</p>
			<p>
				This project is also open source (view on
				<a target="_blank" href="https://github.com/alezen9/revo-realms"
					>GitHub | revo-realms</a
				>), and all the implementation is freely available to explore, learn
				from, or build upon. Credit is appreciated but not required.
			</p>
			<p>
				This project exists solely to showcase my personal growth and hobbies —
				it's a learning space, not a commercial product.
			</p>
			<p>
				If you are the rightful owner of any of the referenced IPs and wish to
				have an asset removed, feel free to contact me at
				<span id="email-placeholder"></span>. I will take action without
				hesitation or dispute.
			</p>
		</div>

		<div class="asset">
			<h2>🪨 Rock <span>[3d model]</span></h2>
			<p>
				This work is based on
				<a
					target="_blank"
					href="https://sketchfab.com/3d-models/glacial-erratic-the-cloughmore-stone-rostrover-9a74494d93024599ae1655d908f34c03"
					>Glacial Erratic. The Cloughmore Stone Rostrover</a
				>
				by
				<a target="_blank" href="https://sketchfab.com/mcg3d">MCG 3D</a>
				licensed under
				<a target="_blank" href="http://creativecommons.org/licenses/by/4.0/"
					>CC-BY-4.0</a
				>
			</p>
		</div>

		<div class="asset">
			<h2>🌳 Tree <span>[3d model]</span></h2>
			<p>
				This work is based on
				<a
					target="_blank"
					href="https://sketchfab.com/3d-models/maple-trees-pack-lowpoly-game-ready-lods-b5d2833c258f4054a01ee2b4ef85adf0"
					>Maple trees pack (lowpoly, game ready, LODs)</a
				>
				by
				<a target="_blank" href="https://sketchfab.com/lolipop_1707">LOLIPOP</a>
				licensed under
				<a target="_blank" href="http://creativecommons.org/licenses/by/4.0/"
					>CC-BY-4.0</a
				>
			</p>
		</div>

		<div class="asset">
			<h2>🐉 Goku's hair <span>[3d model]</span></h2>
			<p>
				This work is based on
				<a
					target="_blank"
					href="https://sketchfab.com/3d-models/chibi-goku-3d-printable-figure-6702f4fb92f44708b442fc66abb18f2d"
					>Chibi Goku 3D Printable Figure</a
				>
				by
				<a target="_blank" href="https://sketchfab.com/layerables">layerables</a
				>
				licensed under
				<a target="_blank" href="http://creativecommons.org/licenses/by/4.0/"
					>CC-BY-4.0</a
				>
			</p>
		</div>

		<div class="asset">
			<h2>⚡️ Minato's kunai <span>[3d model]</span></h2>
			<p>
				This work is based on
				<a
					target="_blank"
					href="https://sketchfab.com/3d-models/minatos-kunai-d5a4a7a897ec41b3a2788a1bd4092697"
					>Minato's Kunai</a
				>
				by
				<a target="_blank" href="https://sketchfab.com/mrkblckwd">mrkblckwd</a>
				licensed under
				<a target="_blank" href="http://creativecommons.org/licenses/by/4.0/"
					>CC-BY-4.0</a
				>
			</p>
		</div>

		<div class="asset">
			<h2>🪓 Leviathan Axe <span>[3d model]</span></h2>
			<p>
				This work is based on
				<a
					target="_blank"
					href="https://sketchfab.com/3d-models/kratos-axe-2-by-b0neheart-94c0fac21cf643908128aed69365e456"
					>Kratos Axe 2 by b0neheart</a
				>
				by
				<a target="_blank" href="https://sketchfab.com/androzol">Androzol</a>
				licensed under
				<a target="_blank" href="http://creativecommons.org/licenses/by/4.0/"
					>CC-BY-4.0</a
				>
			</p>
		</div>

		<div class="asset">
			<h2>🪵 Tree trunk for Leviathan Axe <span>[3d model]</span></h2>
			<p>
				This work is based on
				<a
					target="_blank"
					href="https://sketchfab.com/3d-models/low-poly-tree-trunk-variety-pack-767715600a334e76940c7e09f3f4cb7f"
					>Low Poly Tree Trunk Variety Pack</a
				>
				by
				<a target="_blank" href="https://sketchfab.com/ra3id">Glowbox 3D</a>
				licensed under
				<a target="_blank" href="http://creativecommons.org/licenses/by/4.0/"
					>CC-BY-4.0</a
				>
			</p>
		</div>

		<div class="asset">
			<h2>👺 JoJo mask <span>[3d model]</span></h2>
			<p>
				This work is based on
				<a
					target="_blank"
					href="https://sketchfab.com/3d-models/jojo-ishikamen-stone-mask-b23b52dfca2545db92e5a57877df0118"
					>JOJO Ishikamen stone mask</a
				>
				by
				<a target="_blank" href="https://sketchfab.com/DopamineWarlock"
					>DopamineWarlock</a
				>
				licensed under
				<a target="_blank" href="http://creativecommons.org/licenses/by/4.0/"
					>CC-BY-4.0</a
				>
			</p>
		</div>

		<div class="asset">
			<h2>ゴ JoJo menacing symbol <span>[3d model]</span></h2>
			<p>
				This work is based on
				<a
					target="_blank"
					href="https://sketchfab.com/3d-models/menacing-symbol-jojo-9b0d8b545cc14f1597199c11d8095015"
					>Menacing ゴ Symbol - Jojo</a
				>
				by
				<a target="_blank" href="https://sketchfab.com/adamw1806"
					>09williamsad</a
				>
				licensed under
				<a target="_blank" href="http://creativecommons.org/licenses/by/4.0/"
					>CC-BY-4.0</a
				>
			</p>
		</div>

		<div class="asset">
			<h2>🪵 Campfire base (wood & rocks) <span>[3d model]</span></h2>
			<p>
				This work is based on
				<a
					target="_blank"
					href="https://sketchfab.com/3d-models/campfire-c9d956a68c894a92bc5bedd5fed95831"
					>Campfire</a
				>
				by
				<a target="_blank" href="https://sketchfab.com/filthycent">filthycent</a
				>
				licensed under
				<a target="_blank" href="http://creativecommons.org/licenses/by/4.0/"
					>CC-BY-4.0</a
				>
			</p>
		</div>

		<div class="asset">
			<h2>⚽️ Football ball (player skin) <span>[3d model]</span></h2>
			<p>
				This work is based on
				<a
					target="_blank"
					href="https://sketchfab.com/3d-models/football-ball-5660a4969d7e4b6f94038ea2ad3cd722"
					>Football ball</a
				>
				by
				<a target="_blank" href="https://sketchfab.com/OlegBochkarevRU"
					>MechanicRU</a
				>
				licensed under
				<a target="_blank" href="http://creativecommons.org/licenses/by/4.0/"
					>CC-BY-4.0</a
				>
			</p>
		</div>

		<hr />
		<!-- audio below -->

		<div class="asset">
			<h2>🦜 Background nature <span>[sound]</span></h2>
			<p>
				Sound Effect by
				<a
					target="_blank"
					href="https://pixabay.com/users/oxidvideos-37598254/?utm_source=link-attribution&utm_medium=referral&utm_campaign=music&utm_content=217410"
					>Alex</a
				>
				from
				<a
					target="_blank"
					href="https://pixabay.com/sound-effects//?utm_source=link-attribution&utm_medium=referral&utm_campaign=music&utm_content=217410"
					>Pixabay</a
				>
			</p>
		</div>

		<div class="asset">
			<h2>🌊 Lake water <span>[sound]</span></h2>
			<p>
				Sound Effect by
				<a
					target="_blank"
					href="https://pixabay.com/users/prem_adhikary-34699741/?utm_source=link-attribution&utm_medium=referral&utm_campaign=music&utm_content=176820"
					>Premankur Adhikary</a
				>
				from
				<a
					target="_blank"
					href="https://pixabay.com//?utm_source=link-attribution&utm_medium=referral&utm_campaign=music&utm_content=176820"
					>Pixabay</a
				>
			</p>
		</div>

		<div class="asset">
			<h2>💥 Rock impact <span>[sound]</span></h2>
			<p>
				<a
					target="_blank"
					href="https://freesound.org/people/ultraaxvii/sounds/591152/"
					>rock hitting icy lake</a
				>
				by
				<a target="_blank" href="https://freesound.org/people/ultraaxvii/"
					>ultraaxvii</a
				>
				| License:
				<a
					target="_blank"
					href="http://creativecommons.org/publicdomain/zero/1.0/"
					>Creative Commons 0</a
				>
			</p>
		</div>

		<div class="asset">
			<h2>💥 Wood impact <span>[sound]</span></h2>
			<p>
				<a
					target="_blank"
					href="https://freesound.org/people/super8ude/sounds/442538/"
					>TreeChop5.wav</a
				>
				by
				<a target="_blank" href="https://freesound.org/people/super8ude/"
					>super8ude</a
				>
				| License:
				<a
					target="_blank"
					href="http://creativecommons.org/publicdomain/zero/1.0/"
					>Creative Commons 0</a
				>
			</p>
		</div>

		<hr />
		<!-- honorable mentions below -->

		<div class="asset">
			<h2>👤 Bruno Simon <span>[Honorable mention]</span></h2>
			<p>
				Bruno reignited my motivation to pursue side projects and introduced me
				to the world of 3D with his amazing course. His approach gave me the
				tools — and the push — to finally explore a field I had admired for so
				long, up until then only as a consumer. This project is largely inspired
				by his portfolio (both old and new), though it's filtered through my own
				curiosity and skillset.
			</p>
			<a target="_blank" href="https://www.youtube.com/@BrunoSimon">YouTube</a>
		</div>

		<div class="asset">
			<h2>👤 Simondev <span>[Honorable mention]</span></h2>
			<p>
				I discovered SimonDev while researching how to make grass — and ended up
				watching nearly all his videos (some more than once). His calm, clear
				explanations made even complex concepts feel accessible, and his content
				helped me understand graphics from a new perspective.
			</p>
			<a target="_blank" href="https://www.youtube.com/@simondev758">YouTube</a>
		</div>

		<div class="asset">
			<h2>👤 Acerola <span>[Honorable mention]</span></h2>
			<p>
				I stumbled upon Acerola by chance — maybe through a recommendation,
				maybe during a deep dive into rendering topics — and got instantly
				hooked. His mix of technical depth, sarcasm, and humor made his videos
				both fun and enlightening. Like SimonDev, I ended up binge-watching
				almost everything on his channel.
			</p>
			<a target="_blank" href="https://www.youtube.com/@Acerola_t">YouTube</a>
		</div>

		<div class="asset">
			<h2>🌄 Poly Haven <span>[Honorable mention]</span></h2>
			<p>
				Huge thanks to Poly Haven for providing an incredible library of
				high-quality textures, many of which I used throughout this project.
				Their library of free textures is a blessing for curious developers
				trying to make things look better than they probably should.
			</p>
			<a target="_blank" href="https://polyhaven.com/">Poly Heaven</a>
		</div>
	</div>
</dialog>

<style>
	dialog {
		margin: auto;
		position: fixed;
		inset: 0;
		overflow: auto;
		border-radius: 7px;
		border: none;
		color: #d4d3d3;
		width: 100%;
		max-width: 70%;
		height: calc(100% - 6em);
		background-color: rgba(0, 0, 0, 0.75);
		backdrop-filter: blur(25px);
	}

	dialog .credits-content {
		--padding: 3rem;
		display: flex;
		flex-direction: column;
		width: calc(100% - var(--padding) * 2);
		padding: var(--padding);
		gap: 1rem;
	}

	dialog .credits-content h1 {
		margin-bottom: 1rem;
	}

	dialog .credits-content .credits-status {
		margin-top: -0.5rem;
		margin-bottom: 0.75rem;
		padding: 0.75rem 1rem;
		border-radius: 7px;
		background-color: #ffffff14;
		color: #d7c8a3;
		line-height: 1.35rem;
	}

	dialog .asset h2 span {
		font-weight: 400;
		font-size: 1rem;
		margin-left: 0.25rem;
	}

	dialog .credits-content p {
		color: #ababab;
	}

	dialog .credits-content .gratitude {
		margin-bottom: 1rem;
		line-height: 1.35rem;
	}

	dialog .credits-content .asset {
		border-radius: 7px;
		padding: 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		background-color: #ffffff11;
	}

	dialog a {
		color: #bb7a01;
	}

	dialog a:visited {
		color: #bb4b01;
	}

	@media screen and (max-width: 650px) {
		dialog {
			max-width: 85%;
		}

		dialog .credits-content {
			--padding: 1rem;
		}

		dialog .credits-content h1 {
			font-size: 1.5rem;
		}

		dialog .credits-content h2 {
			font-size: 1.1rem;
		}
	}
</style>
