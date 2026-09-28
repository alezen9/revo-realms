type PostPass<TInput, TOutput> = {
  apply: (input: TInput) => TOutput;
  render?: () => void;
};

type PostSource<TOutput> = {
  output: TOutput;
  render: () => void;
};

type RenderablePass = {
  render?: () => void;
};

export class PostChain<TOutput> {
  readonly output: TOutput;
  private passes: RenderablePass[];

  private constructor(output: TOutput, passes: RenderablePass[]) {
    this.output = output;
    this.passes = passes;
  }

  static from<TSourceOutput>(source: PostSource<TSourceOutput>) {
    return new PostChain(source.output, [source]);
  }

  pipe<TNextOutput>(pass: PostPass<TOutput, TNextOutput>) {
    const output = pass.apply(this.output);
    return new PostChain(output, [...this.passes, pass]);
  }

  render() {
    for (const pass of this.passes) if (pass.render) pass.render();
  }
}
