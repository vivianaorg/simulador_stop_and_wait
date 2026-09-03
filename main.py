# main.py
import tkinter as tk
from gui import SimulatorGUI

def main():
    root = tk.Tk()
    app = SimulatorGUI(root)
    root.mainloop()

if __name__ == "__main__":
    main()