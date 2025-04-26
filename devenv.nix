{ pkgs, lib, config, inputs, ... }:

{
  languages.python = {
    enable = true;
    poetry.enable = false;
    uv.enable = false;
    venv.enable = true;
  };
  packages = with pkgs; [
    ruff
  ];
}
