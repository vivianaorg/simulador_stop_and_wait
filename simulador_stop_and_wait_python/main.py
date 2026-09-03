# main.py
import os
import sys
import tkinter as tk

# Asegurar que el directorio de este script esté en sys.path
script_dir = os.path.dirname(os.path.abspath(__file__))
if script_dir not in sys.path:
    sys.path.insert(0, script_dir)

try:
    from gui import SimulatorGUI
except ImportError:
    from simulador_stop_and_wait_python.gui import SimulatorGUI

def main():
    root = tk.Tk()
    app = SimulatorGUI(root)
    root.mainloop()

if __name__ == "__main__":
    main()